var ffmpeg = require("kiss-ffmpeg");

// make sure you set the correct path to your video file
var proc = new FFmpeg({
  inputs: "/path/to/your_movie.avi",
  outputs: {
    url: "/path/to/your_target.avi",
    options: {
      "b:v": '1024k', // set video bitrate
      "c:v": "divx", // set target codec
      vf: "setdar=16/9,scale=0.5*in_w:0.5*in_h", // video filter: set aspect ratio & half the video frame size
      r: 24, // set fps
      "b:a": "128k", // set audio bitrate
      "c:a": "libmp3lame", // set audio codec
      ac: 2, // set number of audio channels
      vtag: "DIVX", // set custom option
      f: "avi" // set output format to force
    }
  }
})
  // setup event handlers
  .on("end", function() {
    console.log("file has been converted succesfully");
  })
  .on("error", function(proc, err) {
    console.log("an error happened: " + err.message);
  })
  // run
  .run();
