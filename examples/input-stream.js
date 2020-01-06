var fs = require("fs"),
  { FFmpeg } = require("../index");

// open input stream
var infs = fs.createReaurlream(__dirname + "/test/assets/testvideo-43.avi");

infs.on("error", function(err) {
  console.log(err);
});

// create new ffmpeg processor instance using input stream
// instead of file path (can be any ReadableStream)
var proc = new FFmpeg({
  inputs: infs,
  outputs: {
    url: "/path/to/your_target.flv",
    options: { preset: "flashvideo" }
  }
})
  // setup event handlers
  .on("end", function() {
    console.log("done processing input stream");
  })
  .on("error", function(proc, err) {
    console.log("an error happened: " + err.message);
  })
  // start the process
  .run();
