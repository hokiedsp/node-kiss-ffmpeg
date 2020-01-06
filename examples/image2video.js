var ffmpeg = require("kiss-ffmpeg");

// make sure you set the correct path to your video file
var proc = FFmpeg({
  inputs: {
    url: "/path/to/your_image.jpg",
    options: {
      loop: 5, // loop for 5 seconds
      r: 25 // using 25 fps
    },
    outputs: "/path/to/your_target.m4v"
  }
})
  // setup event handlers
  .on("end", function() {
    console.log("file has been converted succesfully");
  })
  .on("error", function(proc, err) {
    console.log("an error happened: " + err.message);
  })
  .run();
