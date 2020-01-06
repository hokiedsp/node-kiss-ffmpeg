var { FFmpeg } = require("../index");

/*
 replicates this sequence of commands:

 ffmpeg -i title.mp4 -i source.mp4 -i third.mov -filter_complex: '[0:0] [0:1] [1:0] [1:1] [2:0] [2:1] concat=n=2:v=1:a=1 [v] [a]' \
  -map '[v]' -map '[a]' out.mp4

 */

var firstFile = "title.mp4";
var secondFile = "source.mp4";
var thirdFile = "third.mov";
var outPath = "out.mp4";

var proc = new FFmpeg({
  inputs: [firstFile, secondFile, thirdFile],
  outputs: { url: outPath, options: { map: ["v", "a"] } },
  global: {
    filter_complex:
      "[0:0] [0:1] [1:0] [1:1] [2:0] [2:1] concat=n=3:v=1:a=1 [v] [a]"
  }
})
  .on("end", function() {
    console.log("files have been merged succesfully");
  })
  .on("error", function(proc, err) {
    console.log("an error happened: " + err.message);
  })
  .run();
