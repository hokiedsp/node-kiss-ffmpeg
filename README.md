# KISS (Keep It Stupid Simple) FFmpeg-API for Node.js

[![Build Status](https://travis-ci.com/hokiedsp/node-kiss-ffmpeg.svg?branch=master)](https://travis-ci.com/hokiedsp/node-kiss-ffmpeg)<!-- [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fnode-kiss-ffmpeg%2Fnode-kiss-ffmpeg.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fkiss-ffmpeg%2Fnode-kiss-ffmpeg?ref=badge_shield) -->

This library is a simple Node.js JavaScript wrapper for [FFmpeg](http://www.ffmpeg.org). It is aimed for those users who are familiar with FFmpeg cli options (See excellent [FFmpeg Documentation](https://ffmpeg.org/documentation.html)). For those who are searching for a fluent, easy to use library, consider using [fluent-ffmpeg library](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg), which this project is loosely based on.

## Features

- Automatic FFmpeg binary path search via FFMPEG_PATH system environmental variable. This feature is especially useful in Windows, when couple with [FFmpeg Winstaller Python script](https://github.com/hokiedsp/ffmpeg-wininstaller). This configuration originates from [fluent-ffmpeg library](https://github.com/fluent-ffmpeg/node-kiss-ffmpeg).
- Wraps ffmpeg & ffprobe binaries for both asynchronous and synchrous execution modes
- FFmpeg class instances provides useful asynchronous runtime features:
  - Custom events to capture the transcoding codec info and progress
  - Automatic redirection of input and output streams

### Prerequisites

#### Node Version

Currently, kiss-ffmpeg requires Node.js v12.0.0 or later as it makes a heavy use of `str.matchAll()`.

#### FFmpeg and FFprobe binaries

kiss-ffmpeg was developed and tested with the latest FFmpeg (v4.2.1) but should work with all recent releases.

If the `FFMPEG_PATH` environment variable is set, kiss-ffmpeg will use it as the full path to the `ffmpeg` executable. Otherwise, it will attempt to call `ffmpeg` directly (so it should be in your `PATH`). You must also have ffprobe installed (it comes with ffmpeg in most distributions). Similarly, kiss-ffmpeg will use the `FFPROBE_PATH` environment variable if it is set. If not found, it then will try `FFMPEG_PATH` then will attempt to call it in the `PATH`.

Most features should work when using avconv and avprobe instead of ffmpeg and ffprobe, but they are not officially supported at the moment.

**Windows users**: most probably ffmpeg and ffprobe will _not_ be in your `%PATH`, so you _must_ set `%FFMPEG_PATH` and `%FFPROBE_PATH`.

## Installation

Via npm:

```sh
$ npm install kiss-ffmpeg
```

Or grabbing the latest version directly from GitHub as npm Dependency in `package.json`,

```json
"dependencies": {
  "kiss-ffmpeg": "git+https://github.com/hokiedsp/node-kiss-ffmpeg.git",
}
```

Or as a submodule:

```sh
$ git submodule add git://github.com/hokiedsp/node-kiss-ffmpeg.git vendor/kiss-ffmpeg
```

## Usage

### kiss-ffmpeg Module

The kiss-ffmpeg module contains 3 components:

```js
const { FFmpeg, ffprobe, ffprobeSync } = require("kiss-ffmpeg");
```

- `FFmpeg` class, `ffmpeg` binary loose wrapper
- `ffprobe` function to call `ffprobe` asynchronously
- `ffprobeSync` function to call `ffprobe` synchronously

The remainder of this document assumes the above require call has been made.

### Setting binary paths manually

The default paths of both `ffmpeg` and `ffprobe` binary may be overrided during execution.

#### `FFmpeg` Object

The binary path of `ffmpeg` binary is specified in the `command` property of the `FFmpeg` object, which is settable:

```js
FFmpeg.command = "new/path/to/ffmpeg/binary/file"; // full path to the binary file
```

To revert to the default path, set it to a falsy value:

```js
FFmpeg.command = ""; // or any other falsy value
```

#### `ffprobe` and `ffprobeSync` Functions

The `ffprobe` binary path is set by providing `command` key of the `options` input argument of `ffprobe()` and `ffprobeSync()`:

```js
ffprobe("input.mp4", { command: "ffprobe/binary/file" });
ffprobeSync("input.mp4", { command: "ffprobe/binary/file" });
```

<!-- You will find a lot of usage examples (including a real-time streaming example using [flowplayer](http://www.flowplayer.org) and [express](https://github.com/visionmedia/express)!) in the `examples` folder. -->

### Running FFprobe

Both versions of FFprobe functions take the same arguments:

```js
ffprobe(file:String[, options:Object]) => Promise<Object>
ffprobeSync(file:String[, options:Object]) => Object
```

The only difference is that `ffprobe()` returns a promise, which resolves to an Object containing the media information of the input `file`, while `ffprobeSync()` blocks the execution until `ffprobe` completes its execution and returns the Object.

`options` argument accepts most of the cli FFprobe options as its keys. The available options are found [here](https://ffmpeg.org/ffprobe.html). By default, `show_format`, `show_streams`, `show_programs`, and `show_chapters` are enabled. To turn them off, use `hide_format`, `hide_streams`, `hide_programs`, `hide_chapters`, and `hide_all` options.

`ffprobe()` and `ffprobeSync()` utilize the ffprobe option, `-print_format json=compact=1`, to retrieve the media information. Hence, attempting to set `-print_format` option will throw an error (among other options, which obstruct the operation of the functions).

#### Examples

```js
// async call
ffprobe("/path/to/file.mp4")
  .then(info => console.log(info))
  .catch(err => console.error(err));

// sync call (throws error if failed)
let info = ffprobeSync("/path/to/file.mp4");

// retrieve only format info (options as an Array)
info = ffprobeSync("/path/to/file.mp4", ["hide_all", "show_format"]);

// retrieve only video stream info (options as an Object)
info ffprobe("/path/to/file.mp4", {
  hide_all: null, // use null for value of the value-less options
  show_streams: null,
  select_streams: "v"
});

// show SI units & sexagesimal time format
info = ffprobeSync("/path/to/file.mp4", ["pretty"]);
```

### Running FFmpeg

The kiss-ffmpeg `FFmpeg` class instantiates an object, which stores the FFmpeg arguments and runs it accordingly.

```js
let ffmpeg = new FFmpeg();
```

This object has 4 properties:

```js
ffmpeg.inputs; // array of inputs and their FFmpeg options
ffmpeg.outputs; // array of outputs and their FFmpeg options
ffmpeg.global; // FFmpeg global options
ffmpeg.spawnOptions; // child_process.spawn's options argument
```

`ffmpeg.inputs` and `ffmpeg.outputs` follow a similar syntax.

```js
// single input no options
ffmpeg.inputs = "path/to/file.mp4";

// multiple outputs, no options
ffmpeg.outputs = ["path/to/file1.mp4", "path/to/file2.mp4"];

// single input with options
ffmpeg.inputs = { url: "path/to/file.mp4", options: { ss: 1, t: 10 } };

// 3 outputs, 2 with options
ffmpeg.outputs = [
  { url: "path/to/file1.mp4", options: ["an"] },
  "path/to/file2.mp4",
  { url: "path/to/file3.mp4", options: { "c:v": "libx264", "c:a": "aac" } }
];
```

See below for the details of the options arguments.

These properties can be set at the time of the instantiation as well:

```js
ffmpeg = new FFmpeg({inputs: "path/to/file.mp4",
                     outputs:  { url: "path/to/file3.mp4",
                                 options: { "c:v": "libx264", "c:a": "aac" } })
```

Once arguments are set, run FFmpeg either asynchrously or synchronously:

```js
ffmpeg.run()=><ChildProcess>; // internally calls spawn
ffmpeg.runSync()=><Object>;   // internaly calls spawnSync
```

#### FFmpeg input & output urls

The url properties of `inputs` and `outputs` options are typically strings, which are then copied verbatimly as `ffmpeg` spawn arguments. Alternatively, Node.js streams may be given to pipe in/out from the stream. Currently, only 1 stream could be used for input or output because these streams are mapped to stdin and stdout.

TODO: Enable multi-stream support.

#### FFmpeg options

FFmpeg takes 3 types of options: input, output, and global. While the global options applies globally, input and output options are specified per source or destination url, repectively. There are a number of ways to specify any of these options in the FFmpeg instance properties:

| Specified as... | Example                           | Description                                                                                                                                                                              |
| --------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Object          | `{"c:v": "libx264", "an": null}`  | Specify FFmpeg option name (without leading '-') as property name and its value as the property value. For boolean options without value (e.g., `-an`) let the property value be `null`) |
| String[]        | `["y", "qphist"]`                 | Useful if only specifying boolean options.                                                                                                                                               |
| String          | `"-map 0 -c:v libx264 -c:a copy"` | String containing the full set of FFmpeg options as used in cli                                                                                                                          |

If an option must be repeated multiple times, specify all option values as an array in its options property value. This feature is useful in setting the `-map` FFmpeg options:

```js
// to map [v] and [a] output nodes of a complex filter graph
ffmpeg.outputs.map = ["[v]", "[a]"];
```

There are a couple special options, unique to kiss.ffmpeg:

| Type   | Name          | Description                                                                                                                                                                                                     |
| ------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| global | `show_banner` | kiss.ffmpeg by default specifies `-hide_banner` global option when calling FFmpeg to minimize clatter in stderr stream. Use this option to override the default behavior.                                       |
| output | `keepopen`    | When an output stream object is specified instead of url string, kiss.ffmpeg automatically closes the stream when FFmpeg process exits. Specifing `keepopen` option to the piped output leaves the stream open. |

**Note:** Be aware that these option settings are **not** validated by kiss-ffmpeg.

### Setting event handlers

Before actually running FFmpeg asynchronously via `ffmpeg.run()`, you may want to set event listeners on it to be notified when FFmpeg process is done. There are 2 ways to capture events from the FFmpeg process: via the Child_Process instance `run()` returns or via the `FFmpeg` instance. Please see [Node.js Child_Process documentation](https://nodejs.org/api/child_process.html#child_process_class_childprocess) for the former, and `FFmpeg` instance fires the following events:

| Event Name   | Callback Signature       | Description                                                                                        |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------------------- |
| `start`      | `cb(proc)`               | Emitted immediately after FFmpeg process begun                                                     |
| `codecData`  | `cb(proc, data)`         | Emitted when FFmpeg finish printing its job summary                                                |
| `progress`   | `cb(proc, status)`       | Emitted when FFmpeg printed a progress line                                                        |
| `close`      | `cb(proc, code, signal)` | Pass-through event from ChildProcess                                                               |
| `disconnect` | `cb(proc)`               | Pass-through event from ChildProcess                                                               |
| `error`      | `cb(proc, err)`          | Emits errors passed from ChildProcess or last line FFmpeg printed before terminating with status=1 |
| `end`        | `cb(proc, code, signal)` | Pass-through event from ChildProcess `exit` event                                                  |

#### Event: `'start'`

- `proc` \<ChildProcess\> The ChildProcess instance returned by `ffmpeg.run()`

The `start` event is emitted just after FFmpeg has been spawned. It is emitted with the Child_Process object, which was spawned when `run()` was called.

```js
ffmpeg.on("start", function(proc) {
  console.log("Spawned FFmpeg with command: " + proc.spawnargs.join(" "));
});
```

#### Event: `'codecData'`

- `proc` \<ChildProcess\> The ChildProcess instance returned by `ffmpeg.run()`
- `data` \<object\>
  - `inputs` \<object[]\> An array of object containing the FFmpeg input info with properties:
    - `type` \<string\> Always equals `'input'`
    - `index` \<number\> Input index#
    - `format` \<string\> Container format string
    - `url` \<string\> URL of the input
    - `duration` \<number\> Total duration of the media content in seconds
    - `start` \<number\> Starting time in seconds
    - `bitrate` \<number\> Data bitrate in bits/s
    - `metadata` \<object\> (Optional) Key-value pairs
    - `chapters` \<object[]\> (Optional) Array of chapters
      - `index` \<number\> Chapter number
      - `start` \<number\> Starting time in seconds
      - `end` \<number\> Ending time in seconds
    - `programs` \<object[]\> (Optional) Array of programs
      - `name` \<string\> Program name or `"-"` for dangling streams
      - `streams` \<object[]\> Streams that are part of the program. See immediately below for its content.
    - `streams` \<object\> Contained streams (only if no program is defined)
      - `index` \<number\> Stream index
      - `type` \<string\> Stream type: `"video"`|`"audio"`|`"subtitle"`|`"data"`
      - `codecdata` \<string[]\> String array describing the various codec settings
      - `disposition` \<string[]\> Array of dispositions
      - `sidedata` \<string\> Side data
      - `metadata` \<object\> Key-value pairs
  - `outputs` \<object[]\> Array of object containing the FFmpeg output info. Its object content is identical to that of the `inputs` object except for the properties, `duration`, `start`, and `bitrate` are not included.

The `codecData` event is emitted when ffmpeg prints input and output codec information.

```js
ffmpeg.on("codecData", function(data) {
  // assume both audio & video streams exist and no programs defined
  let audiocodec = data.inputs[0].streams
    .find(st => st.type === "audio")
    .codecdata[0].split(" ")[0];
  let videocodec = data.inputs[0].streams
    .find(st => (st.type = "video"))
    .codecdata[0].split(" ")[0];
  console.log(`Input is ${audiocodec} audio with ${videocodec} video`);
});
```

#### Event: `'progress'`

- `proc` \<ChildProcess\> The ChildProcess instance returned by `ffmpeg.run()`
- `status` \<object\>
  - `qp_hist` \<string\> (Optional) 32-character qp histogram, which is printed when `qphist` global option is specified
  - `frame` \<number\> (Video only) # of frames processed
  - `fps` \<number\> (Video only) frame processing speed in frames/s
  - `q` \<number|Number[]\> (Video only) Video quality index. If more than one output video stream.
  - `last` \<Boolean\> (Video only) Present only if last progress event and reports true
  - `psnr` \<object\> (Video only) Reported PSNR values when `psnr` global(?) option is given.
    - `y` \<number\> PSNR of Y channel
    - `u` \<number\> PSNR of U channel
    - `v` \<number\> PSNR of V channel
    - `*` \<number\> Total PSNR
  - `size` \<number\> Current output file size in bytes
  - `time` \<number\> Current timestamp in seconds
  - `bitrate` \<number\> Current bitrate in bits/s
  - `dup` \<number\> Current number of duplicated frames
  - `drop` \<number\> Current number of dropped frames
  - `speed` \<number\> Current encoding speed relative to the playback speed

The `progress` event is emitted every time ffmpeg reports progress information.

To report the percent completed, the expected total duration shall be precomputed and compare `status.time` to it. For example, a full transcoding job outputs a media file that equals its duration to its input file. Thus, the duration of the output file could be retrieved from `codecData` event:

```js
let T; // total time to be retrieved
ffmpeg
  .on("codecData", (proc, data) => {
    T = data.inputs[0].duration;
  })
  .on("progress", (proc, status) {
    console.log(`Processing: ${(status.time/T*100).toFixed(0)}% done");
  });
```

For more complex jobs, predetermine the output duration by utilizing `ffprobe`/`ffprobeSync`.

#### Event `'close'`

- `proc` \<ChildProcess\> The ChildProcess instance returned by `ffmpeg.run()`
- `code` \<number\> The exit code if `proc` exited on its own.
- `signal` \<string\> The signal by which `proc` was terminated.

The `'close'` event is a redirected event from the spawned ChildProcess object and is emitted when the stdio streams of a FFmpeg process have been closed. This is distinct from the `'end'` event, since multiple processes might share the same stdio streams.

#### Event: `'disconnect'`

- `proc` \<ChildProcess\> The ChildProcess instance returned by `ffmpeg.run()`

The `'disconnect'` event is a redirected event from the spawned ChildProcess object and is emitted after calling the `proc.disconnect()` method in parent process. After disconnecting it is no longer possible to send or receive messages, and the `proc.connected` property is false.

#### Event: `'error'`

- `proc` \<ChildProcess\> The ChildProcess instance returned by `ffmpeg.run()`
- `err` \<Error\> Error object returned from `proc`

The `error` event is emitted when an error occurs when running FFmpeg. This includes `proc` emitting its own `error` event or `proc` exits with non-zero `code` or terminated by a signal or errors passed from underlying ChildProcess.

```js
ffmpeg.on("error", (proc, err) => {
  console.error(`Cannot process video: `${err.message}`);
});
```

#### Event: `'end'`

- `proc` \<ChildProcess\> The ChildProcess instance returned by `ffmpeg.run()`
- `code` \<number\> The exit code if `proc` exited on its own.
- `signal` \<string\> The signal by which `proc` was terminated.

The `end` event is emitted when `proc` exited.

### FFmpeg Examples

#### Save the output to a file

Starts ffmpeg processing and saves the output to a file.

```js
new FFmpeg({
  inputs: "/path/to/file.avi",
  outputs: {
    url: "/path/to/output.mp4",
    options: { "c:v": "libx264", "c:a": "libmp3lame", vf: "scale=w=320:h=240" }
  }
})
  .on("error", (proc, err) => {
    console.error("An error occurred: " + err.message);
  })
  .on("end", () => {
    console.log("Processing finished !");
  })
  .run();
```

#### Pipe the output to a writable stream

Starts processing and pipes ffmpeg output to a writable stream.

```js
var outStream = fs.createWriteStream("/path/to/output.mp4");

new FFmpeg({
  inputs: "/path/to/file.avi",
  outputs: {
    url: outStream,
    options: { "c:v": "libx264", "c:v": "libmp3lame", vf: "scale=w=320:h=240" }
  }
})
  .on("error", (proc, err) => {
    console.error("An error occurred: " + err.message);
  })
  .on("end", () => {
    console.log("Processing finished !");
  })
  .run();
```

If the connected streams are not available at a spawning time of the FFmpeg process, use `"pipe:0"` as the input url and `"pipe:1"` as the output url. The `proc.stdin` and `proc.stdout` streams can then be used to feed/retrieve data.

```js
const proc = new FFmpeg({
  inputs: "/path/to/file.avi",
  outputs: {
    url: "pipe:1",
    options: { "c:v": "libx264", "c:v": "libmp3lame", vf: "scale=w=320:h=240" }
  }
})
  .on("error", (proc, err) => {
    console.error("An error occurred: " + err.message);
  })
  .on("end", () => {
    console.log("Processing finished !");
  })
  .run();

const outStream = fs.createWriteStream("/path/to/output.mp4");
proc.stdout
  .on("data", data => {
    outStream.write(data);
  })
  .on("close", () => outStream.end());
```

#### Produce multiple outputs

```js
new FFmpeg({
  inputs: "/path/to/file.avi",
  outputs: [
    { url: "screenshot.png", options: { an: null, ss: 180 } },
    {
      url: "small.avi",
      options: { "c:v": "copy", "c:a": "copy", vf: "scale=w=320:h=200" }
    },
    { url: "big.avi", options: { "c:a": "copy", vf: "scale=w=640:h=480" } }
  ]
})
  .on("error", err => {
    console.error(`An error occurred: ${err.message}`);
  })
  .on("end", () => {
    console.log("Processing finished !");
  })
  .run();
```

#### Concatenate multiple inputs

```js
new FFmpeg({
  inputs: ["/path/to/part1.avi", "/path/to/part2.avi", "/path/to/part2.avi"],
  outputs: {url: "/path/to/merged.avi", map: ["[vout]","[aout]"]},
  global: {filter_complex: "[0:0] [0:1] [1:0] [1:1] [2:0] [2:1] concat=n=3:v=1:a=1 [vout] [aout]"}
});
  .on("error", function(err) {
    console.error(`An error occurred: ${err.message}`);
  })
  .on("end", function() {
    console.log("Merging finished !");
  });
```

#### Extract frames as images

```js
// only one frame at 7-second mark
new FFmpeg({
  inputs: "/path/to/video.avi",
  outputs: { url: "thumb.jpg", options: { ss: 7, vframes: 1 } }
}).on("end", function() {
  console.log("Screenshots taken");
});

// three frames each separated by 1 second
new FFmpeg({
  inputs: "/path/to/video.avi",
  outputs: { url: "thumb%04d.jpg", options: { vf: "fps=1", vframes: 3 } }
}).on("end", function() {
  console.log("Screenshots taken");
});
```

### Querying capabilities of the installed FFmpeg

kiss-ffmpeg `FFmpeg` class has read-only static class properties supported formats, codecs, encoders and filters.

```js
FFmpeg.version; // FFmpeg version
FFmpeg.formats; // available formats (including devices)
FFmpeg.demuxers; // available demuxers
FFmpeg.muxers; // available muxers
FFmpeg.devices; // available devices
FFmpeg.codecs; // all known codecs
FFmpeg.encoders; // available encoders
FFmpeg.decoders; // available decoders
FFmpeg.bsfs; // available bitstream filters
FFmpeg.filters; // available filters
FFmpeg.pix_fmts; // available pixel formats
FFmpeg.sample_fmts; // available audio sample formats
FFmpeg.layouts; // channel names and standard channel layouts
FFmpeg.colors; // recognized color names
```

Some properties return an object with additional parameters for each entry while others return an string array.

Furthermore, there are static class methods to get more details:

```js
FFmpeg.getMuxerInfo(name); // name: any of FFmpeg.muxers keys
FFmpeg.getDemuxerInfo(name); // name: any of FFmpeg.demuxers keys
FFmpeg.getEncoderInfo(name); // name: any of FFmpeg.encoders keys
FFmpeg.getDecoderInfo(name); // name: any of FFmpeg.decoders keys
FFmpeg.getBsfInfo(name); // name: any of FFmpeg.bsfs element
FFmpeg.getFilterInfo(name); // name: any of FFmpeg.filters keys
```

`getXxxInfo()` methods throw error if the name is invalid. To check check if the supplied FFmpeg binary supports the required feature, use `supportsXxx()` methods:

```js
// returns true if supported, false otherwise
FFmpeg.supportsMuxer(name);
FFmpeg.supportsDemuxer(name);
FFmpeg.supportsEncoder(name);
FFmpeg.supportsDecoder(name);
FFmpeg.supportsBsf(name);
FFmpeg.supportsFilter(name);
```

### Spawning a bare FFmpeg process

kiss.ffmpeg FFmpeg class exposes low-level static functions to spawn FFmpeg process:

```js

// asynchronous
FFmpeg.spawn(args:String[][, options:Object]) => <ChildProcess>

//synchronous
FFmpeg.spawnSync(args:String[][, options:Object]) => <Object>

```

They wrap Node.js's `child_process.spawn` and `child_process.spawnSync`, respectively, and their arguments are passed down unaltered to the respective arguments of the `child_process` functions.

## Contributing

Contributions in any form are highly encouraged and welcome! Be it new or improved presets, optimized streaming code or just some cleanup. So start forking!

### Code contributions

If you want to add new features or change the API, please submit an issue first to make sure no one else is already working on the same thing and discuss the implementation and API details with maintainers and users by creating an issue. When everything is settled down, you can submit a pull request.

When fixing bugs, you can directly submit a pull request.

Make sure to add tests for your features and bugfixes and update the documentation (see below) before submitting your code!

### Documentation contributions

You can directly submit pull requests for documentation changes. Make sure to regenerate the documentation before submitting (see below).

## License

(The MIT License)

Copyright (c) 2019 Takeshi Ikuma &lt;tikuma@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
