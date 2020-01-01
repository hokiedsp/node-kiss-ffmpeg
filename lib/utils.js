/*jshint node:true*/
"use strict";

const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

var nlRegexp = /\r\n|\r|\n/g;
var streamRegexp = /^\[?(.*?)\]?$/;
var filterEscapeRegexp = /[,]/;
const reArgs = /-([a-zA-Z].*?)(?:\s+((?:[^-\s]|-(?=\d)).*?))?(?=\s+-|$)/g;

var utils = (module.exports = {
  parseOpts: function(argstr) {
    const matches = argstr.matchAll(reArgs);
    let user = {};
    for (const m of matches) {
      const key = m[1];
      if (!(key in user)) user[key] = m[2];
      else if (Array.isArray(user[key])) user[key].push(m[2]);
      else user[key] = [user[key], m[2]];
    }
    return user;
  },

  /**
   *
   * @param {Any} user     Options specified by the user. Maybe given as
   *                       - options Object with (dash-less) option names as keys and their values as values.
   *                       - String[] of boolean options
   *                       - String of already parsed options
   * @param {Object} def      Default option Object.
   * @param {Object} fixed    Default fixed option Object. User defined object with the same key will be rejected.
   * @param {String[]} ignore List of options to be ignored if given
   * @param {Object} specs Contains special options, which actions are specified by functions in their values.
   *                          Functions have the signature: func(opts,key,val) where opts is the option Object, which
   *                          is currently being constructed.
   * @param {String[]} args   Existing ffxxxx arguments to append current options to
   *
   */
  opts2args: function(user, options = {}, args = []) {
    const cplx = Boolean(options);
    if (typeof user === "string") {
      if (cplx) {
        // parse given string to form an options Object
        user = utils.parseOpts(user);
      } else {
        // if no special treatment is necessary, simply split options and append to args
        args.push(...user.match(reArgs));
        return args;
      }
    }

    if (Array.isArray(user)) {
      if (cplx) {
        // convert to Object format
        user = user.reduce((u, k) => {
          if (!(k in u)) u[k] = null;
          else if (Array.isArray(u[k])) u[k].push(null);
          else u = [null, null];
          return u;
        }, {});
      } else {
        args.push(...user.map(key => `-${key}`));
        return args;
      }
    }

    // combine options
    let ops = {
      def: {},
      fixed: {},
      error: [],
      ignore: [],
      specs: {},
      ...options
    };
    let opts = { ...ops.def, ...ops.fixed };
    for (const key in user) {
      if (key in ops.fixed || ops.error.includes(key)) {
        throw new Error(`${key} option cannot be set`);
      } else if (key in ops.specs) {
        ops.specs[key](opts, key, user[key]);
      } else if (!ops.ignore.includes(key)) opts[key] = user[key];
    }

    for (const key in opts) {
      let arg = `-${key}`,
        val = opts[key];
      (Array.isArray(val) ? val : [val]).forEach(v => {
        args.push(arg);
        if (v !== undefined && v !== null) args.push(String(v));
      });
    }

    return args;
  },

  which: (file, envname = "") => {
    const hasEnv = Boolean(envname && process.env[envname]);
    const isWin = process.platform === "win32";
    if (isWin && !file.endsWith(".exe")) file += ".exe";

    let p = hasEnv ? path.join(process.env[envname], file) : file;
    if (hasEnv) {
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      } catch (err) {}
    }

    const { status } = spawnSync(isWin ? "where /Q" : "which", [file]);
    if (status === 0) return file;
    else return "";
  },

  /**
   * Generate filter strings
   *
   * @param {String[]|Object[]} filters filter specifications. When using objects,
   *   each must have the following properties:
   * @param {String} filters.filter filter name
   * @param {String|Array} [filters.inputs] (array of) input stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically choosing the first unused matching streams
   * @param {String|Array} [filters.outputs] (array of) output stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically assigning the output to the output file
   * @param {Object|String|Array} [filters.options] filter options, can be omitted to not set any options
   * @return String[]
   * @private
   */
  makeFilterStrings: function(filters) {
    return filters.map(function(filterSpec) {
      if (typeof filterSpec === "string") {
        return filterSpec;
      }

      var filterString = "";

      // Filter string format is:
      // [input1][input2]...filter[output1][output2]...
      // The 'filter' part can optionaly have arguments:
      //   filter=arg1:arg2:arg3
      //   filter=arg1=v1:arg2=v2:arg3=v3

      // Add inputs
      if (Array.isArray(filterSpec.inputs)) {
        filterString += filterSpec.inputs
          .map(function(streamSpec) {
            return streamSpec.replace(streamRegexp, "[$1]");
          })
          .join("");
      } else if (typeof filterSpec.inputs === "string") {
        filterString += filterSpec.inputs.replace(streamRegexp, "[$1]");
      }

      // Add filter
      filterString += filterSpec.filter;

      // Add options
      if (filterSpec.options) {
        if (
          typeof filterSpec.options === "string" ||
          typeof filterSpec.options === "number"
        ) {
          // Option string
          filterString += "=" + filterSpec.options;
        } else if (Array.isArray(filterSpec.options)) {
          // Option array (unnamed options)
          filterString +=
            "=" +
            filterSpec.options
              .map(function(option) {
                if (
                  typeof option === "string" &&
                  option.match(filterEscapeRegexp)
                ) {
                  return "'" + option + "'";
                } else {
                  return option;
                }
              })
              .join(":");
        } else if (Object.keys(filterSpec.options).length) {
          // Option object (named options)
          filterString +=
            "=" +
            Object.keys(filterSpec.options)
              .map(function(option) {
                var value = filterSpec.options[option];

                if (
                  typeof value === "string" &&
                  value.match(filterEscapeRegexp)
                ) {
                  value = "'" + value + "'";
                }

                return option + "=" + value;
              })
              .join(":");
        }
      }

      // Add outputs
      if (Array.isArray(filterSpec.outputs)) {
        filterString += filterSpec.outputs
          .map(function(streamSpec) {
            return streamSpec.replace(streamRegexp, "[$1]");
          })
          .join("");
      } else if (typeof filterSpec.outputs === "string") {
        filterString += filterSpec.outputs.replace(streamRegexp, "[$1]");
      }

      return filterString;
    });
  },

  /**
   * Parse the data blob dumped by libavformat/av_dump_format()
   *
   * @param {String} dump
   */
  parseFormatDump: function(dump) {
    // console.log(dump);
    let m = dump.match(
      /(Output|Input) #(\d+), (\S+), (?:to|from) '([^']+)':\r?\n/
    );
    if (!m) return null;

    const isOutput = m[1] == "Output";

    let format = {
      type: m[1].toLowerCase(),
      index: Number(m[2]),
      format: m[3],
      url: m[4]
    };
    dump = dump.slice(m.index + m[0].length);

    if (!isOutput) {
      m = dump.match(
        /  Duration: ([^,]+)(?:, start: ([^,]+))?, bitrate: (.+?)\r?\n|$/
      );
      if (m[1] !== "N/A") format.duration = timeStr2Sec(m[1]);
      if (m[2]) format.start = Number(m[2]);
      if (m[3] !== "N/A") format.bitrate = Number(m[3].slice(0, -5)) * 1000;

      dump = dump.slice(m.index + m[0].length);
    }

    let chunkStart = [
      ...dump.matchAll(
        /(?<=^|\n)(?:    Chapter|  Program|  No Program|    Stream)/g
      )
    ].map(m => m.index);
    let chunkEnd = [...chunkStart.slice(1), dump.length];

    if (!chunkStart.length && dump.length)
      format.metadata = parseMetaDataDump(dump, "  ");
    else if (chunkStart[0] > 0 && isOutput)
      format.metadata = parseMetaDataDump(dump.slice(0, chunkStart[0]), "  ");

    if (!chunkStart.length) return format;

    let i = 0;
    while (i < chunkStart.length) {
      const chunk = dump.slice(chunkStart[i], chunkEnd[i]);
      ++i;
      if (chunk.startsWith("    Chapter")) {
        m = chunk.match(
          /    Chapter #\d+:(\d+): start ([0-9.-]+), end ([0-9.-]+)\r?\n|$/
        );
        const ch = {
          index: Number(m[1]),
          start: Number(m[2]),
          end: Number(m[3])
        };
        if (format.chapters) format.chapters.push(ch);
        else format.chapters = [ch];
      } else if (chunk.startsWith("  Program")) {
        m = chunk.match(/  Program (\d)+ ([^\r?\n]*)\r?\n|$/);
        const p = { index: Number(m[1]), name: m[2] };
        if (!p.name) delete p.name;
        if (format.programs) format.programs.push(p);
        else format.programs = [p];
      } else if (chunk.startsWith("  No Program")) {
        const p = { index: "-" };
        format.programs.push(p);
      } // "stream"
      else {
        const st = parseStreamDump(chunk);
        const pr = format.programs
          ? format.programs[format.programs.length - 1]
          : format;
        if (pr.streams) pr.streams.push(st);
        else pr.streams = [st];
      }
    }

    return format;
  },

  /**
   * Parse progress line from ffmpeg stderr
   *
   * @param {String} line progress line
   * @return progress object
   * @private
   */
  parseProgressLine: function(line) {
    const matches = line.matchAll(
      /(L)|([0-9a-f]{32})|PSNR=Y:(\S+) U:(\S+) V:(\S+) \*:(\S+)|(\S+)=\s*(\S+)/g
    );
    if (!matches) return null;
    let progress = {};
    for (const m of matches) {
      if (m[1]) {
        // console.log(`last: ${m[1]}`);
        progress.last = true;
      } else if (m[2]) {
        progress.qp_hist = m[2];
      } else if (m[3]) {
        progress.psnr = {
          y: Number(m[3]),
          u: Number(m[4]),
          v: Number(m[5]),
          "*": Number(m[6])
        };
      } else {
        const key = m[7];
        let val = m[8];
        if (val === "N/A") continue;
        switch (key) {
          case "frame":
          case "fps":
          case "q":
          case "dup":
          case "drop":
            val = Number(val);
            break;
          case "size": // %8.0fkB
            val = Number(val.slice(0, -2)) * 1024;
            break;
          case "time": // %s%02d:%02d:%02d.%02d
            val = timeStr2Sec(val);
            break;
          case "bitrate": // %6.1fkbits/s
            val = Number(val.slice(0, -7)) * 1000;
            break;
          case "speed": // %4.3gx
            val = Number(val.slice(0, -1));
            break;
        }
        if (key in progress) {
          if (Array.isArray(progress[key])) progress[key].push(val);
          else progress[key] = [progress[key], val];
        } else {
          progress[key] = val;
        }
      }
    }

    return progress;
  },

  /**
   * Extract error message(s) from ffmpeg stderr
   *
   * @param {String} stderr ffmpeg stderr data
   * @return {String}
   * @private
   */
  extractError: function(stderr) {
    // Only return the last stderr lines that don't start with a space or a square bracket
    return stderr
      .split(nlRegexp)
      .reduce(function(messages, message) {
        if (message.charAt(0) === " " || message.charAt(0) === "[") {
          return [];
        } else {
          messages.push(message);
          return messages;
        }
      }, [])
      .join("\n");
  }
});

function parseStreamDump(dump) {
  // console.log("Stream Dump:", dump);
  let m = dump.match(
    /Stream #\d+:(\d+)(?:\[0x([0-9a-f]+)\])?(?:\(([^)]+)\))?: (Audio|Video|Subtitle|Data|Attachment|Unknown): ([^\r\n]+)\r?(?:\n|$)/
  );
  if (!m) return dump;

  let stream = {
    index: Number(m[1]),
    type: m[4].toLowerCase()
  };
  if (m[2]) stream.id = Number(m[2]);
  if (m[3]) stream.language = m[3];

  stream.codecdata = m[5].split(",");
  let lastdata = stream.codecdata.pop();
  if (lastdata.endsWith(")")) {
    let offset,
      disps = [];
    for (m of lastdata.matchAll(/ \((.+?)\)/g)) {
      if (!offset) offset = m.index;
      disps.push(m[1]);
    }
    stream.codecdata.push(lastdata.slice(0, offset));
    stream.dispositions = disps;
  }

  dump = dump.slice(m.index + m[0].length);
  if (!dump) return stream;

  m = dump.match(/    Side data:\r?\n\s+(.+)/);
  if (m) {
    stream.sidedata = m[1];
    dump = dump.slice(0, m.index);
    if (!dump) return stream;
  }

  m = dump.match(/    Metadata:\r?\n(.+)/);
  if (m) stream.metadata = parseMetaDataDump(m[0]);

  return stream;
}

function parseMetaDataDump(dump) {
  let metadata = {};
  for (const m of dump.matchAll(/(\S[^:\r\n]*?):([^\r\n]+)\r?(?:\n|$)/g))
    metadata[m[1].trimEnd()] = m[2].trim();
  return metadata;
}

function timeStr2Sec(str) {
  const time = str.match(/(-?)(\d{2}):(\d{2}):(\d{2}.\d+)/);
  let sec = 3600 * Number(time[2]) + 60 * Number(time[3]) + Number(time[4]);
  if (time[1]) sec = -sec;
  return sec;
}
