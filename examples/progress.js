var fs = require("fs"),
  { FFmpeg } = require("../index");

// open input stream
var infs = fs.createReaurlream(__dirname + "/test/assets/testvideo-43.avi");
var T;

infs.on("error", function(err) {
  console.log(err);
});

var proc = new FFmpeg({
  inputs: infs,
  outputs: {
    url: "/path/to/your_target.flv",
    options: {
      preset: "flashvideo"
    }
  }
})
  // setup event handlers
  .on("codecData", function(proc, data) {
    T = data.inputs[0].duration;
  })
  .on("progress", function(proc, info) {
    console.log("progress " + ((info.time / T) * 100).toFixed + "%");
  })
  .on("end", function() {
    console.log("done processing input stream");
  })
  .on("error", function(proc, err) {
    console.log("an error happened: " + err.message);
  })
  .run();
