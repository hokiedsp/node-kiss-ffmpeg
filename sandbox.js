"use strict";

const path = require("path");
const { FFmpeg, ffprobe, ffprobeSync } = require(".");
const fs = require("fs");

const testdir = path.join(__dirname, "test", "assets");
const testfileName = "testvideo-43.avi";
const testfile = path.join(testdir, testfileName);
const testfilewide = path.join(testdir, "testvideo-169.avi");
const testfilebig = path.join(testdir, "testvideo-5m.mpg");
const testfilespecial = path.join(testdir, "te[s]t_ video ' _ .flv");
const testfileaudio1 = path.join(testdir, "testaudio-one.wav");
const testfileaudio2 = path.join(testdir, "testaudio-two.wav");
const testfileaudio3 = path.join(testdir, "testaudio-three.wav");

// ffprobeSync("", ['hide_versions']);
var divx_outopts = {
  f: "avi",
  "b:v": "1024k",
  "c:v": "mpeg4",
  vf: "scale=w=720:h=-1",
  "b:a": "128k",
  ac: 2,
  "c:a": "libmp3lame",
  vtag: "DIVX"
};

// var testFile = path.join(__dirname, "test", "assets", "testOnCodecData.avi");

var testFile1 = path.join(
  __dirname,
  "test",
  "assets",
  "testMultipleOutput1.avi"
);
var testFile2 = path.join(
  __dirname,
  "test",
  "assets",
  "testMultipleOutput2.avi"
);
var testFile3 = path.join(
  __dirname,
  "test",
  "assets",
  "testMultipleOutput3.mp4"
);

const ffmpeg = new FFmpeg({
  inputs: testfile,
  outputs: [
    {
      url: testFile1,
      options: {
        "c:a": "libvorbis",
        "c:v": "copy"
      }
    },
    {
      url: testFile2,
      options: {
        "c:a": "libmp3lame",
        "c:v": "copy"
      }
    },
    {
      url: testFile3,
      options: {
        "c:a": "aac",
        "c:v": "libx264",
        vf: "scale=w=160:h=120"
      }
    }
  ]
})
  .on("start", proc => {
    // console.log(proc);
  })
  .on("codecData", (proc, data) => {
    console.log(data);
    console.log(data.inputs[0].streams);
    console.log(data.outputs[0].streams);
  })
  .on("error", function({ stdout, stderr }, err) {
    if (err) console.log(`errored out: ${err}`);
  });

console.log(ffmpeg.parseArgs());

const proc = ffmpeg.run();
new Promise((resolve, reject) =>
  proc.on("exit", (code, signal) => (code || signal ? reject() : resolve()))
)
  .then(() => {
    console.log("done");
  })
  .catch(err => {
    console.error(err);
  });

// proc.stderr.on("data", data => console.log(data));

//   .then(json => console.log(json))
//   .catch(err => console.error(err.path));

// ffprobe(testfilebig,['hide_all'])
// ffprobe(testfilebig, {
// hide_all: null,
// show_streams: null,
// select_streams: "a"
// show_data: null,
// show_error: null,
// show_packets: null,
// show_frames: null,
// count_frames: null,
// count_packets: null,
// show_private_data: null,
// show_program_version: null,
// show_library_versions: null,
// show_versions: null,
// show_pixel_formats: null
// })
//   .then(json => console.log(json))
//   .catch(err => console.error(err.path));

// -select_streams stream_specifier // Select only the streams specified by stream_specifier.
// -show_entries section_entries // Set list of entries to show.
// // LOCAL_SECTION_ENTRIES ::= SECTION_ENTRY_NAME[,LOCAL_SECTION_ENTRIES]
// // SECTION_ENTRY         ::= SECTION_NAME[=[LOCAL_SECTION_ENTRIES]]
// // SECTION_ENTRIES       ::= SECTION_ENTRY[:SECTION_ENTRIES]
// -show_log loglevel // Show logging information from the decoder about each frame according to the value set in loglevel, (see -loglevel). This option requires -show_frames.
// // The information for each log message is printed within a dedicated section with name "LOG".

// - //Count the number of frames per stream and report it in the corresponding stream section.
// - // Count the number of packets per stream and report it in the corresponding stream section.
// -read_intervals read_intervals //Read only the specified intervals. read_intervals must be a sequence of interval specifications separated by ",". ffprobe will seek to the interval starting point, and will continue reading from that.
// -, -private // Show private data, that is data depending on the format of the particular shown element. This option is enabled by default, but you may need to disable it for specific uses, for example when creating XSD-compliant XML output.
// - //Show information related to program version.
// // Version information is printed within a section with name "PROGRAM_VERSION".
// - //Show information related to library versions.
// // Version information for each library is printed within a section with name "LIBRARY_VERSION".
// - //Show information related to program and library versions. This is the equivalent of setting both -show_program_version and -show_library_versions options.
// -//Show information about all pixel formats supported by FFmpeg.
// // Pixel format information for each format is printed within a section with name "PIXEL_FORMAT".
// -bitexact //Force bitexact output, useful to produce output which is not dependent on the specific build.

new FFmpeg({
  inputs: "/path/to/file.avi",
  outputs: {
    url: "/path/to/output.mp4",
    options: { "c:v": "libx264", "c:a": "libmp3lame", vf: "scale=w=320:h=240" }
  }
})
  .on("error", (proc, err) => {
    console.log("An error occurred: " + err.message);
  })
  .on("end", () => {
    console.log("Processing finished !");
  })
  .run();

new FFmpeg({
  inputs: ["/path/to/part1.avi", "/path/to/part2.avi", "/path/to/part2.avi"],
  outputs: "/path/to/merged.avi",
  global: {}
});
