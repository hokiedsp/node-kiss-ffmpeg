var { FFmpeg } = require("../index"),
  fs = require("fs");

// create the target stream (can be any WritableStream)
var stream = fs.createWriteStream("/path/to/yout_target.flv");

// make sure you set the correct path to your video file
var proc = new FFmpeg({
  inputs: "/path/to/your_movie.avi",
  outputs: { url: stream, options: { preset: "flashvideo" } }
})
  // setup event handlers
  .on("end", function() {
    console.log("file has been converted succesfully");
  })
  .on("error", function(proc, err) {
    console.log("an error happened: " + err.message);
  })
  .run();
