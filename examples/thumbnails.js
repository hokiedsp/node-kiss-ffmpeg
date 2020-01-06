var ffmpeg = require("../index");

// take 2 screenshots at predefined timemarks and size
var proc = new FFmpeg({
  inputs: "/path/to/your_movie.avi",
  outputs: {
    url: "/path/to/thumbnail/folder/thumb%04d.jpg",
    options: {
      ss: 2,
      vf: "fps=1/4, scale=150:100",
      vframes: 2
    }
  }
})
  // setup event handlers (filenames event is not supported in kiss-ffmpeg)
  // .on("filenames", function(filenames) {
  //   console.log("screenshots are " + filenames.join(", "));
  // })
  .on("end", function() {
    console.log("screenshots were saved");
  })
  .on("error", function(proc, err) {
    console.log("an error happened: " + err.message);
  })
  .run();
