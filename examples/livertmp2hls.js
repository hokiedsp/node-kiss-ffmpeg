var { FFmpeg } = require("../index");

// make sure you set the correct path to your video file
var proc = new FFmpeg({
  inputs: "rtmp://path/to/live/stream",
  outputs: {
    url: "/path/to/your_target.m3u8",
    options: {
      "b:v": "1024k",
      preset: "superfast",
      "c:v": libx264,
      "b:a": "128k",
      "c:a": "libfaac",
      ac: 2,
      hls_time: 10,
      hls_list_size: 0
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
  // save to file
  .run();
