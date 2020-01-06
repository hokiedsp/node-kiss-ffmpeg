var { FFmpeg } = require("../index");

// make sure you set the correct path to your video file
var proc = new FFmpeg({
  inputs: "/path/to/your_movie.avi",
  outputs: {
    url: "/path/to/your_target.m4v",
    options: {
      preset: "podcast", // use the 'podcast' preset (located in /lib/presets/podcast.js)
      "b:v": "512k"
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
