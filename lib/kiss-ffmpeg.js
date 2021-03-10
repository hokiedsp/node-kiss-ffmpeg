/*jshint node:true*/
"use strict";

const cp = require("child_process");
const utils = require("./utils");
const { EventEmitter } = require("events");
const path = require("path");
const caps = require("./capabilities");

class FFmpegError extends Error {
  constructor(proc, err, log) {
    const isError = err instanceof Error;
    super(
      isError ? err.message : err,
      isError ? err.fileName : undefined,
      isError ? err.lineNumber : undefined
    );
    this.command = proc.spawnargs.join(" ");
    this.log = log;
  }
}

class FFmpeg extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.inputs = []; // array of input names or {url, options}. url maybe 'stdin' to pipe in the data
    this.outputs = []; // array of {url, options}. file maybe 'stdout' to pipe out
    this.global = {}; // key-value pairs of global options
    this.spawnOptions = {}; // spawn options
    Object.assign(this, opts);

    // # of event listeners
    this._monitor = false;
    this.on("newListener", eventName => {
      if (eventName === "progress" || eventName === "codecData")
        this._monitor = true;
    });
    this.on("removeListener", eventName => {
      if (
        (eventName === "progress" || eventName === "codecData") &&
        !this.listenerCount("progress") &&
        !this.listenerCount("codecData")
      )
        this._monitor = false;
    });
    this.on("error", () => {}); // guard against default error handling
  }

  /**
   * Create FFmpeg CLI argument array for the current configuration
   */
  parseArgs() {
    const global_opts = {
      def: { y: null, hide_banner: null },
      specs: {
        n: opts => {
          if ("y" in opts) delete opts[y];
          opts.n = null;
        },
        y: opts => {
          if ("n" in opts) delete opts[n], (opts.y = null);
        },
        show_banner: opts => delete opts.hide_banner
      }
    };
    let args = utils.opts2args(this.global, global_opts);

    (Array.isArray(this.inputs) ? this.inputs : [this.inputs]).forEach(i => {
      if (i.options) utils.opts2args(i.options, {}, args);
      let url = i.url ? i.url : i;
      if (url.readable) url = "pipe:0";
      args.push("-i");
      args.push(url);
    });
    (Array.isArray(this.outputs) ? this.outputs : [this.outputs]).forEach(o => {
      if (o.options) utils.opts2args(o.options, { ignore: ["keepopen"] }, args);
      let url = o.url ? o.url : o;
      if (url.writable) url = "pipe:1";
      args.push(path.normalize(url));
    });
    return args;
  }

  /**
   * Run FFmpeg asynchronously
   */
  run() {
    // if progress events are expected to be fired, check user's options.stdio and
    // override stderr settings
    const self = this;
    let stdioerr = null;
    let log = "";

    let options = this.spawnOptions;

    function setStdioToPipe(fid) {
      if (options.stdio) {
        // pipe is the default
        let warn = false;
        if (Array.isArray(options.stdio)) {
          if ((warn = options.stdio[fid] !== "pipe"))
            options.stdio[fid] = "pipe";
        } else if ((warn = options.stdio !== "pipe")) {
          options.stdio = [options.stdio, options.stdio, "pipe"];
        }
        if (warn)
          console.warn(
            `[kiss-ffmpeg] ${
              ["stdin", "stdout", "stderr"][fid]
            } configuration has changed to 'pipe' to enable progress events.`
          );
      }
    }

    if (this._monitor && options.stdio) setStdioToPipe(2);

    // see if any input stream needs to be redirected to stdin
    let use_stdin = false;
    let stdin_st;
    (Array.isArray(this.inputs) ? this.inputs : [this.inputs]).forEach(
      input => {
        const url = input.url ? input.url : input;
        if (url.readable || url === "pipe:" || url === "pipe:0") {
          if (use_stdin)
            throw Error("Only one input source may be set to stdin");
          else use_stdin = true;
        }
        if (url.readable) stdin_st = url;
      }
    );
    if (use_stdin) setStdioToPipe(0);

    // see if any output stream needs to be redirected to stdout
    let use_stdout = false;
    let stdout_st;
    let stdout_close = true;
    (Array.isArray(this.outputs) ? this.outputs : [this.outputs]).forEach(
      output => {
        const url = output.url ? output.url : output;
        if (url.writable || url === "pipe:" || url === "pipe:1") {
          if (use_stdout)
            throw Error("Only one output destination may be set to stdout");
          else use_stdout = true;
          if (output.options && "keepopen" in output.options) {
            stdout_close = false;
          }
        }
        if (url.writable) stdout_st = url;
      }
    );
    if (use_stdout) setStdioToPipe(1);

    const proc = FFmpeg.spawn(this.parseArgs(), options);
    this.emit("start", proc);

    let smonitors = []; // stream monitoring callback controls

    if (use_stdin) {
      proc.stdin.setEncoding("binary");
      if (stdin_st) {
        smonitors.push(
          new utils.streamMonitor(
            stdin_st,
            [
              "data",
              data => {
                if (proc.stdin.writable) proc.stdin.write(data);
              }
            ],
            [
              "close",
              () => {
                if (!proc.stdin.writableEnded) proc.stdin.end();
              }
            ],
            [
              "error",
              err => {
                stdioerr = `Input stream error: ${err.message}`;
                proc.kill("SIGINT");
              }
            ]
          )
        );
      }
    }
    if (use_stdout) {
      proc.stdout.setEncoding("binary");
      if (stdout_st) {
        proc.stdout
          .on("data", data => {
            if (stdout_st.writable) stdout_st.write(data);
          })
          .on("close", code => {
            if (stdout_close && !stdout_st.writableEnded) stdout_st.end();
          });

        smonitors.push(
          new utils.streamMonitor(stdout_st, [
            "error",
            err => {
              stdioerr = `Output stream error: ${err.message}`;
              proc.kill("SIGINT");
            }
          ])
        );
      }
    }

    proc.stderr.setEncoding("utf8");

    let buf = "",
      errmsg = "";
    function parseError(data) {
      const blocks = (buf + data).split(/\r?\n(?!\s|$)/);
      buf = blocks.pop(); // exlude the last block
      if (buf.match(/\r?\n$/)) errmsg = buf;
    }
    if (this._monitor) {
      let inputs = [],
        outputs = [],
        mapping = [],
        headerDone = false;
      function parseHeader(data) {
        const blocks = (buf + data).split(/\r?\n(?!\s|$)/);
        buf = blocks.pop(); // exlude the last block
        // if the last block is a complete progress msg, push it back
        if (buf.match(/\r?\n$/)) errmsg = buf;
        if (buf.match(/^(?:frame|size).*?(?:\r|\r?\n)/)) {
          blocks.push(buf);
          buf = "";
        }
        let m;
        for (let i = 0; i < blocks.length; ++i) {
          const block = blocks[i];
          if ((m = block.match(/^(Input|Output) #/))) {
            if (m[1] === "Output") outputs.push(utils.parseFormatDump(block));
            else inputs.push(utils.parseFormatDump(block));
          } else if (block.startsWith("Stream mapping:")) {
          } else if (block.match(/^(?:frame|size)/)) {
            headerDone = true;
            if (buf) buf = `\n${buf}`;
            buf = blocks.slice(i).join("\n") + buf;
            break;
          }
        }
        if (headerDone) {
          proc.stderr.off("data", parseHeader);
          proc.stderr.on("data", parseProgress);
          proc.stderr.off("close", pipeClosed);

          // emit codecData event
          emitCodecData();

          // recursively all
          if (buf.match(/\r?\n$/)) parseError("");
        }
      }
      function parseProgress(data) {
        const blocks = (buf + data).split(/\r|\r?\n(?!\s|$)/);
        buf = blocks.pop(); // exlude the last block
        if (buf.match(/\r?\n$/)) errmsg = buf;
        if (buf.match(/^(?:frame|size).*?(?:\r|\r?\n)/)) {
          blocks.push(buf);
          buf = "";
        }
        if (buf.match(/\r?\n$/)) {
          blocks.push(buf);
          buf = "";
        }
        let progress;
        for (const block of blocks) {
          if (block.match(/^(?:frame|size)/)) {
            self.emit(
              "progress",
              proc,
              (progress = utils.parseProgressLine(block))
            );
          }
        }
        if (progress && progress.last) {
          proc.stderr.off("data", parseProgress);
          proc.stderr.on("data", parseError);
        }
      }
      function pipeClosed() {
        if (!headerDone) emitCodecData();
      }
      function emitCodecData() {
        let header;
        if (inputs.length) header = { inputs };
        if (outputs.length)
          header = Object.assign(header ? header : {}, { outputs });
        if (mapping.length)
          header = Object.assign(header ? header : {}, { mapping });

        if (header) self.emit("codecData", proc, header);
      }
      proc.stderr.on(
        "data",
        self.listenerCount("codecData") ? parseHeader : parseProgress
      );
      proc.stderr.on("close", pipeClosed);
    } else {
      proc.stderr.on("data", parseError);
    }

    // redirects child process events
    proc
      .on("close", (code, signal) => {
        self.emit("close", proc, code, signal);
      })
      .on("disconnect", () => {
        self.emit("disconnect", proc);
      })
      .on("error", err => {
        self.emit("error", proc, err);
      })
      .on("exit", (code, signal) => {
        // stop all the external stream monitoring callbacks
        smonitors.forEach(m => m.stop());
        if (stdout_st && stdout_close && !stdout_st.writableEnded)
          stdout_st.end();

        if (code) {
          const m = errmsg.match(/Exiting normally, received signal (\d+)\./);
          if (m) signal = utils.strsignal(Number(m[1]));
          else self.emit("error", proc, new FFmpegError(proc, errmsg, log));
        }
        if (stdioerr) {
          self.emit("error", proc, new FFmpegError(proc, stdioerr, log));
          stdioerr;
        } else if (signal) {
          self.emit(
            "error",
            proc,
            new FFmpegError(
              proc,
              `FFmpeg was terminated with signal ${signal}`,
              log
            )
          );
        }

        self.emit("end", proc, code, signal);
      });

    proc.stderr.on("data", data => (log += data));
    // proc.stdin.on(
    //   "error",
    //   err => (
    //     (stdioerr = `Input stream error: ${err.message}`), proc.kill("SIGPIPE")
    //   )
    // );
    // proc.stdout.on(
    //   "error",
    //   err => (
    //     (stdioerr = `Output stream error: ${err.message}`), proc.kill("SIGPIPE")
    //   )
    // );
    // proc.stderr.on(
    //   "error",
    //   err => (
    //     (stdioerr = `Error stream error: ${err.message}`), proc.kill("SIGPIPE")
    //   )
    // );

    return proc;
  }

  /**
   * Run FFmpeg synchronously (no events are triggered)
   * @param {Object} options for child_process.spawnSync()
   */
  runSync() {
    return FFmpeg.spawnSync(this.parseArgs(), this.spawnOptions);
  }
}

// Set FFmpeg static properties
Object.defineProperty(FFmpeg, "command", {
  get: function() {
    return this._command ? this._command : "ffmpeg";
  },
  set: function(p) {
    this._command = p ? p : utils.which("ffmpeg", "FFMPEG_PATH");
  }
});
FFmpeg.command = ""; // initialize

Object.defineProperty(FFmpeg, "spawn", {
  get: () => (args, options) => cp.spawn(FFmpeg.command, args, options)
});
Object.defineProperty(FFmpeg, "spawnSync", {
  get: () => (args, options) => {
    const ret = cp.spawnSync(FFmpeg.command, args, options);
    if (ret.error) throw ret.error;
    return ret;
  }
});
Object.defineProperty(FFmpeg, "spawnSyncUtf8", {
  get: () => (args, options = {}) =>
    FFmpeg.spawnSync(args, { encoding: "utf8", ...options })
});

Object.defineProperty(FFmpeg, "version", {
  get: () => FFmpeg.spawnSyncUtf8(["-version"]).stdout.match(/version (\S+)/)[1]
});
Object.defineProperty(FFmpeg, "formats", {
  get: () => caps.availableFormats(FFmpeg.spawnSyncUtf8, "formats")
});
Object.defineProperty(FFmpeg, "demuxers", {
  get: () => caps.availableFormats(FFmpeg.spawnSyncUtf8, "demuxers")
});
Object.defineProperty(FFmpeg, "muxers", {
  get: () => caps.availableFormats(FFmpeg.spawnSyncUtf8, "muxers")
});
Object.defineProperty(FFmpeg, "devices", {
  get: () => caps.availableFormats(FFmpeg.spawnSyncUtf8, "devices")
});
Object.defineProperty(FFmpeg, "codecs", {
  get: () => caps.availableCodecs(FFmpeg.spawnSyncUtf8)
});
Object.defineProperty(FFmpeg, "encoders", {
  get: () => caps.availableCoders(FFmpeg.spawnSyncUtf8, "encoders")
});
Object.defineProperty(FFmpeg, "decoders", {
  get: () => caps.availableCoders(FFmpeg.spawnSyncUtf8, "decoders")
});
Object.defineProperty(FFmpeg, "bsfs", {
  get: () => caps.availableBSFilters(FFmpeg.spawnSyncUtf8)
});
Object.defineProperty(FFmpeg, "protocols", {
  get: () => caps.availableProtocols(FFmpeg.spawnSyncUtf8)
});
Object.defineProperty(FFmpeg, "filters", {
  get: () => caps.availableFilters(FFmpeg.spawnSyncUtf8)
});
Object.defineProperty(FFmpeg, "pix_fmts", {
  get: () => caps.availablePixFmts(FFmpeg.spawnSyncUtf8)
});
Object.defineProperty(FFmpeg, "sample_fmts", {
  get: () => caps.availableSampleFmts(FFmpeg.spawnSyncUtf8)
});
Object.defineProperty(FFmpeg, "layouts", {
  get: () => caps.availableLayouts(FFmpeg.spawnSyncUtf8)
});
Object.defineProperty(FFmpeg, "colors", {
  get: () => caps.availableColors(FFmpeg.spawnSyncUtf8)
});
Object.defineProperty(FFmpeg, "getDemuxerInfo", {
  get: () => name => caps.getDemuxerInfo(FFmpeg.spawnSyncUtf8, name)
});
Object.defineProperty(FFmpeg, "getMuxerInfo", {
  get: () => name => caps.getMuxerInfo(FFmpeg.spawnSyncUtf8, name)
});
Object.defineProperty(FFmpeg, "getDecoderInfo", {
  get: () => name => caps.getCodecInfo(FFmpeg.spawnSyncUtf8, name, false)
});
Object.defineProperty(FFmpeg, "getEncoderInfo", {
  get: () => name => caps.getCodecInfo(FFmpeg.spawnSyncUtf8, name, true)
});
Object.defineProperty(FFmpeg, "getFilterInfo", {
  get: () => name => caps.getFilterInfo(FFmpeg.spawnSyncUtf8, name)
});
Object.defineProperty(FFmpeg, "getBsfInfo", {
  get: () => name => caps.getBsfInfo(FFmpeg.spawnSyncUtf8, name)
});

Object.defineProperty(FFmpeg, "supportsDemuxer", {
  get: () => name => caps.supportCheck(FFmpeg.getDemuxerInfo, name)
});
Object.defineProperty(FFmpeg, "supportsMuxer", {
  get: () => name => caps.supportCheck(FFmpeg.getMuxerInfo, name)
});
Object.defineProperty(FFmpeg, "supportsDecoder", {
  get: () => name => caps.supportCheck(FFmpeg.getDecoderInfo, name)
});
Object.defineProperty(FFmpeg, "supportsEncoder", {
  get: () => name => caps.supportCheck(FFmpeg.getEncoderInfo, name)
});
Object.defineProperty(FFmpeg, "supportsFilter", {
  get: () => name => caps.supportCheck(FFmpeg.getFilterInfo, name)
});
Object.defineProperty(FFmpeg, "supportsBsf", {
  get: () => name => caps.supportCheck(FFmpeg.getBsfInfo, name)
});

exports = module.exports = FFmpeg;
