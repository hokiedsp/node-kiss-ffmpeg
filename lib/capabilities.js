/*jshint node:true*/
"use strict";

/*
 *! Capability helpers
 */

// var avCodecRegexp = /([D ])([E ])([VAS])([S ])([D ])([T ])\s+([^=\s][\S]*)\s+(.*)/g;
const ffCodecRegexp = /([D.])([E.])([VAS])([I.])([L.])([S.])\s+([^=\s][\S]*)\s+(.*)/g;
const ffEncodersRegexp = /\s+\(encoders:([^\)]+)\)/;
const ffDecodersRegexp = /\s+\(decoders:([^\)]+)\)/;
const coderRegexp = /([VAS])([F.])([S.])([X.])([B.])([D.])\s+([^=\s]\S*)\s+(.*)/g;
const formatRegexp = /([D ])([E ]) (\S+) +(.*)/g;
const filterRegexp = /([T.])([S.])([C.])\s+(\S+)\s+(A+|V+|N|\|)->(A+|V+|N|\|)\s+(.*)/g;

var cache = {};

function _(spawnSyncUtf8, cap) {
  if ("cap" in cache) return { data: cache[cap] };

  const ret = spawnSyncUtf8([`-${cap}`], {
    stdio: ["ignore", "pipe", "ignore"]
  });

  return { stdout: ret.stdout };
}

function __(spawnSyncUtf8, type, name) {
  if (type in cache && name in cache[type]) return { data: cache[type][name] };

  const ret = spawnSyncUtf8(["--help", `${type}=${name}`, "-hide_banner"], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  return { stdout: ret.stdout, stderr: ret.stderr };
}

module.exports = {
  /**
   * A callback passed to {@link FfmpegCommand#availableFilters}.
   *
   * @callback FfmpegCommand~filterCallback
   * @param {Function} spawnSyncUtf8 function to synchronously spawn FFmpeg
   * @returns {Object} filter object with filter names as keys and the following
   *   properties for each filter:
   * @returns {String} filters.description filter description
   * @returns {String} filters.input input type, one of 'audio', 'video' and 'none'
   * @returns {Boolean} filters.multipleInputs whether the filter supports multiple inputs
   * @returns {String} filters.output output type, one of 'audio', 'video' and 'none'
   * @returns {Boolean} filters.multipleOutputs whether the filter supports multiple outputs
   * @returns {Error|null} err error object or null if no error happened
   */

  /**
   * reversed fftools/comdutils.c show_filters()
   *
   * @method FfmpegCommand#availableFilters
   * @category Capabilities
   * @aliases getAvailableFilters
   *
   * @param {FfmpegCommand~filterCallback} callback callback function
   */
  availableFilters: function(spawnSyncUtf8) {
    let { stdout, data } = _(spawnSyncUtf8, "filters");
    if (data) return data;

    const types = { A: "audio", V: "video", N: "dynamic", "|": "none" };

    const matches = stdout.matchAll(filterRegexp);
    data = {};
    for (const match of matches) {
      data[match[4]] = {
        description: match[7],
        input: types[match[5].charAt(0)],
        multipleInputs: match[5].length > 1,
        output: types[match[6].charAt(0)],
        multipleOutputs: match[6].length > 1,
        timelineSupport: match[1] === "T",
        sliceThreading: match[2] === "S",
        commandSupport: match[3] === "C"
      };
    }
    return (cache.filters = data);
  },

  /**
   * A callback passed to {@link FfmpegCommand#availableCodecs}.
   *
   * @callback FfmpegCommand~codecCallback
   * @param {Error|null} err error object or null if no error happened
   * @param {Object} codecs codec object with codec names as keys and the following
   *   properties for each codec (more properties may be available depending on the
   *   ffmpeg version used):
   * @param {String} codecs.description codec description
   * @param {Boolean} codecs.canDecode whether the codec is able to decode streams
   * @param {Boolean} codecs.canEncode whether the codec is able to encode streams
   */

  /**
   * reversed fftools/comdutils.c show_codecs()
   *
   * @method FfmpegCommand#availableCodecs
   * @category Capabilities
   * @aliases getAvailableCodecs
   *
   * @param {FfmpegCommand~codecCallback} callback callback function
   */
  availableCodecs: function(spawnSyncUtf8) {
    let { stdout, data } = _(spawnSyncUtf8, "codecs");
    if (data) return data;

    const matches = stdout.matchAll(ffCodecRegexp);
    data = {};
    for (const match of matches) {
      let desc = match[8];
      var encoders = desc.match(ffEncodersRegexp);
      if (encoders)
        desc =
          desc.slice(0, encoders.index) +
          desc.slice(encoders.index + encoders[0].length);
      encoders = encoders ? encoders[1].trim().split(" ") : undefined;

      var decoders = desc.match(ffDecodersRegexp);
      if (decoders)
        desc =
          desc.slice(0, decoders.index) +
          desc.slice(decoders.index + decoders[0].length);
      decoders = decoders ? decoders[1].trim().split(" ") : undefined;

      data[match[7]] = {
        type: { V: "video", A: "audio", S: "subtitle" }[match[3]],
        description: desc,
        canDecode: match[1] === "D",
        decoders: decoders,
        canEncode: match[2] === "E",
        encoders: encoders,
        intraFrameOnly: match[4] === "I",
        isLossy: match[5] === "L",
        isLossless: match[6] === "S"
      };
      if (!encoders) delete data[match[7]].encoders;
      if (!decoders) delete data[match[7]].decoders;
    }

    return (cache.codecs = data);
  },

  /**
   * A callback passed to {@link FfmpegCommand#availableEncoders}.
   *
   * @callback FfmpegCommand~encodersCallback
   * @param {Error|null} err error object or null if no error happened
   * @param {Object} encoders encoders object with encoder names as keys and the following
   *   properties for each encoder:
   * @param {String} encoders.description codec description
   * @param {Boolean} encoders.type "audio", "video" or "subtitle"
   * @param {Boolean} encoders.frameMT whether the encoder is able to do frame-level multithreading
   * @param {Boolean} encoders.sliceMT whether the encoder is able to do slice-level multithreading
   * @param {Boolean} encoders.experimental whether the encoder is experimental
   * @param {Boolean} encoders.drawHorizBand whether the encoder supports draw_horiz_band
   * @param {Boolean} encoders.directRendering whether the encoder supports direct encoding method 1
   */

  /**
   * reversed fftools/comdutils.c show_encoders()
   *
   * @method FfmpegCommand#availableEncoders
   * @category Capabilities
   * @aliases getAvailableEncoders
   *
   * @param {FfmpegCommand~encodersCallback} callback callback function
   */
  availableCoders: function(spawnSyncUtf8, type) {
    let { stdout, data } = _(spawnSyncUtf8, type);
    if (data) return data;

    const matches = stdout.matchAll(coderRegexp);
    data = {};
    for (const match of matches) {
      data[match[7]] = {
        type: { V: "video", A: "audio", S: "subtitle" }[match[1]],
        description: match[8],
        frameMT: match[2] === "F",
        sliceMT: match[3] === "S",
        experimental: match[4] === "X",
        drawHorizBand: match[5] === "B",
        directRendering: match[6] === "D"
      };
    }
    return (cache[type] = data);
  },

  /**
   * A callback passed to {@link FfmpegCommand#availableFormats}.
   *
   * @callback FfmpegCommand~formatCallback
   * @param {Error|null} err error object or null if no error happened
   * @param {Object} formats format object with format names as keys and the following
   *   properties for each format:
   * @param {String} formats.description format description
   * @param {Boolean} formats.canDemux whether the format is able to demux streams from an input file
   * @param {Boolean} formats.canMux whether the format is able to mux streams into an output file
   */

  /**
   * reversed fftools/comdutils.c show_formats()
   *
   * @method FfmpegCommand#availableFormats
   * @category Capabilities
   */
  availableFormats: function(spawnSyncUtf8, type) {
    let { stdout, data } = _(spawnSyncUtf8, type);
    if (data) return data;

    const matches = stdout.matchAll(formatRegexp);
    const doCan = type === "formats" || type === "devices";
    data = {};
    for (const match of matches) {
      match[3].split(",").forEach(function(format) {
        if (!(format in data)) {
          data[format] = {
            description: match[4]
          };
        }
        if (doCan) {
          data[format].canDemux = match[1] === "D";
          data[format].canMux = match[2] === "E";
        }
      });
    }

    return (cache[type] = data);
  },

  // reversed fftools/comdutils.c show_bsfs()
  availableBSFilters: function(spawnSyncUtf8) {
    let { stdout, data } = _(spawnSyncUtf8, "bsfs");
    if (data) return data;

    return (cache.bsfs = stdout
      .replace(/^\s*Bitstream filters:\s+/, "")
      .trimEnd()
      .split(/\s+/));
  },

  // reversed fftools/comdutils.c show_protocols()
  availableProtocols: function(spawnSyncUtf8) {
    let { stdout, data } = _(spawnSyncUtf8, "protocols");
    if (data) return data;

    const match = stdout.match(/Input:([\s\S]+)Output:([\s\S]+)/);
    return (cache.protocols = {
      input: match[1].trim().split(/\s+/),
      output: match[2].trim().split(/\s+/)
    });
  },

  // according to fftools/comdutils.c show_pix_fmts()
  availablePixFmts: function(spawnSyncUtf8) {
    let { stdout, data } = _(spawnSyncUtf8, "pix_fmts");
    if (data) return data;

    const matches = stdout.matchAll(
      /([I.])([O.])([H.])([P.])([B.])\s+(\S+)\s+(\d+)\s+(\d+)/g
    );
    data = {};
    for (const match of matches) {
      data[match[6]] = {
        nbComponents: Number(match[7]),
        bitsPerPixel: Number(match[8]),
        input: match[1] === "I",
        output: match[2] === "O",
        hwAccel: match[3] === "H",
        paletted: match[4] === "P",
        bitstream: match[5] === "B"
      };
    }
    return (cache.pix_fmts = data);
  },

  // according to fftools/comdutils.c show_sample_fmts()
  availableSampleFmts: function(spawnSyncUtf8) {
    let { stdout, data } = _(spawnSyncUtf8, "sample_fmts");
    if (data) return data;

    const matches = stdout.matchAll(/(\S+)\s+(\d+)/g);
    data = {};
    for (const match of matches) {
      data[match[1]] = {
        depth: Number(match[2])
      };
    }
    return (cache.sample_fmts = data);
  },

  // according to fftools/comdutils.c show_layouts()
  availableLayouts: function(spawnSyncUtf8) {
    let { stdout, data } = _(spawnSyncUtf8, "layouts");
    if (data) return data;

    const match = stdout.match(
      /Individual channels:\s+NAME\s+DESCRIPTION\s+([\s\S]+)Standard channel layouts:\s+NAME\s+DECOMPOSITION\s+([\s\S]+)/
    );
    data = { channels: {}, layouts: {} };
    let matches = match[1].matchAll(/(\S+)\s+(.+)\s*\n\s*/g);
    for (const match of matches) {
      data.channels[match[1]] = {
        description: match[2]
      };
    }
    matches = match[2].matchAll(/(\S+)\s+(.+)\s*\n\s*/g);
    for (const match of matches) {
      data.layouts[match[1]] = {
        decomposition: match[2].match(/([^+\s]+)/g)
      };
    }
    return (cache.layouts = data);
  },

  // according to fftools/comdutils.c show_colors()
  availableColors: function(spawnSyncUtf8) {
    let { stdout, data } = _(spawnSyncUtf8, "colors");
    if (data) return data;

    const matches = stdout.matchAll(/(\S+)\s+(#[0-9a-f]{6})/g);
    data = {};
    for (const match of matches) data[match[1]] = { rgb: match[2] };
    return (cache.colors = data);
  },

  // according to fftools/comdutils.c show_help_demuxer()
  getDemuxerInfo: function(spawnSyncUtf8, name) {
    let { stdout, stderr, data } = __(spawnSyncUtf8, "demuxer", name);
    if (data) return data;

    if (stdout.startsWith("Unknown format")) throw new Error(stdout);
    const m = stdout.match(
      /Demuxer (\S+) \[([^\]]+)\]:\r?\n(?:    Common extensions: ([^.]+)\.\r?\n)?([\s\S]*)/
    );

    data = {
      name: m[1],
      long_name: m[2],
      extensions: m[3] ? m[3].split(",") : [],
      options: m[4]
    };
    if (!cache.demuxer) cache.demuxer = {};
    return (cache.demuxer[name] = data);
  },

  // according to fftools/comdutils.c show_help_muxer()
  getMuxerInfo: function(spawnSyncUtf8, name) {
    let { stdout, stderr, data } = __(spawnSyncUtf8, "muxer", name);
    if (data) return data;

    if (stdout.startsWith("Unknown format")) throw new Error(stdout);
    const m = stdout.match(
      /Muxer (\S+) \[([^\]]+)\]:\r?\n(?:    Common extensions: ([^.]+)\.\r?\n)?(?:    Mime type: ([^.]+)\.\r?\n)?(?:    Default video codec: ([^.]+)\.\r?\n)?(?:    Default audio codec: ([^.]+)\.\r?\n)?(?:    Default subtitle codec: ([^.]+).\r?\n)?([\s\S]*)/
    );

    data = {
      name: m[1],
      long_name: m[2],
      extensions: m[3] ? m[3].split(",") : [],
      mime_type: m[4] ? m[4].split(",") : [],
      video_codec: m[5] ? m[5].split(",") : [],
      audio_codec: m[6] ? m[6].split(",") : [],
      subtitle_codec: m[7] ? m[7].split(",") : [],
      options: m[8]
    };
    if (!cache.muxer) cache.muxer = {};
    return (cache.muxer[name] = data);
  },

  // according to fftools/comdutils.c show_help_codec()
  getCodecInfo: function(spawnSyncUtf8, name, encoder) {
    let { stdout, stderr, data } = __(
      spawnSyncUtf8,
      encoder ? "encoder" : "decoder",
      name
    );
    if (data) return data;

    if (
      stdout.startsWith("No codec name specified") ||
      stdout.match(/is not recognized by FFmpeg.\r?\n$/)
    )
      throw new Error(stdout);

    const re = new RegExp(
      `${encoder ? "Encoder" : "Decoder"} (\\S+) \\[([^\\]]*)\\]:\\r?\\n` +
        "    General capabilities: ([^\\r\\n]+?) ?\\r?\\n" +
        "(?:    Threading capabilities: ([^\\r\\n]+?)\\r?\\n)?" +
        "(?:    Supported hardware devices: ([^\\r\\n]*?)\\r?\\n)?" +
        "(?:    Supported framerates: ([^\\r\\n]+?)\\r?\\n)?" +
        "(?:    Supported pixel formats: ([^\\r\\n]+?)\\r?\\n)?" +
        "(?:    Supported sample rates: ([^\\r\\n]+?)\\r?\\n)?" +
        "(?:    Supported sample formats: ([^\\r\\n]+?)\\r?\\n)?" +
        "(?:    Supported channel layouts: ([^\\r\\n]+?)\\r?\\n)?" +
        "([\\s\\S]*)"
    );

    const m = stdout.match(re);

    data = {
      name: m[1],
      long_name: m[2],
      capabilities: m[3] && m[3] !== "none" ? m[3].split(" ") : [],
      threading: m[4] && m[4] !== "none" ? m[4] : "",
      supported_hwdevices: m[5] ? m[5].split(" ") : [],
      supported_framerates: m[6]
        ? m[6].split(" ").map(s => {
            const m = s.match(/(\d+)\/(\d+)/);
            return [Number(m[0]), Number(m[1])];
          })
        : [],
      supported_pix_fmts: m[7] ? m[7].split(" ") : [],
      supported_sample_rates: m[8] ? m[8].split(" ") : [],
      supported_sample_fmts: m[9] ? m[9].split(" ") : [],
      supported_layouts: m[10] ? m[10].split(" ") : [],
      options: m[11]
    };
    if (!cache.muxer) cache.muxer = {};
    return (cache.muxer[name] = data);
  },

  // according to fftools/comdutils.c show_help_filter()
  getFilterInfo: function(spawnSyncUtf8, name) {
    let { stdout, stderr, data } = __(spawnSyncUtf8, "filter", name);
    if (data) return data;

    if (
      stdout.startsWith("No filter name specified.") ||
      stdout.startsWith("Unknown filter ")
    )
      throw new Error(stdout);

    const re = new RegExp(
      `Filter (\\S+)\\r?\\n` +
        "(?:  (.+?)\\r?\\n)?" +
        "(?:    (slice threading supported)\\r?\\n)?" +
        "    Inputs:\\r?\\n([\\s\\S]*?)(?=    Outputs)" +
        "    Outputs:\\r?\\n([\\s\\S]*?\\r?\\n)(?!S)" +
        "([\\s\\S]*)"
    );

    const m = stdout.match(re);

    data = {
      name: m[1],
      description: m[2],
      threading: m[3] ? "slice" : "",
      inputs: getFilterPortInfo(m[4]),
      outputs: getFilterPortInfo(m[5]),
      options: m[6]
    };
    if (!cache.filter) cache.filter = {};
    return (cache.filter[name] = data);
  },

  // according to fftools/comdutils.c show_help_bsf()
  getBsfInfo: function(spawnSyncUtf8, name) {
    let { stdout, stderr, data } = __(spawnSyncUtf8, "bsf", name);
    if (data) return data;

    if (
      stdout.startsWith("No bitstream filter name specified.") ||
      stdout.startsWith("Unknown bit stream filter ")
    )
      throw new Error(stdout);

    const re = new RegExp(
      `Bit stream filter (\\S+)\\r?\\n` +
        "(?:    Supported codecs: ([^\\r\\n]+?)\\r?\\n)?" +
        "([\\s\\S]*)"
    );

    const m = stdout.match(re);

    data = {
      name: m[1],
      supported_codecs: m[2] ? m[2].split(" ") : [],
      options: m[3]
    };
    if (!cache.filter) cache.filter = {};
    return (cache.filter[name] = data);
  },
  supportCheck: function(fun, name) {
    try {
      fun(name);
      return true;
    } catch (err) {
      return false;
    }
  }
};

function getFilterPortInfo(str) {
  if (str.startsWith("        none")) return null;
  if (str.startsWith("        dynamic")) return "dynamic";

  const matches = str.matchAll(/       #\d+: (\S+)(?= \() \((\S+)\)\r?\n/g);
  if (!matches) throw new Error(`Failed to parse filter port info: ${str}`);
  return Array.from(matches).map(m => ({
    name: m[1],
    type: m[2]
  }));
}
