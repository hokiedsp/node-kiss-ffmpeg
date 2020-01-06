var { ffprobeSync } = require("../index");

// make sure you set the correct path to your video file
console.log(
  require("util").inspect(ffprobeSync("/path/to/your_movie.avi"), false, null)
);
