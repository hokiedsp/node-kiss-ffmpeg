/*jshint node:true*/
/*global describe,it,before,after,beforeEach,afterEach*/
"use strict";

const { FFmpeg } = require("../index"),
  async = require("async"),
  path = require("path"),
  fs = require("fs"),
  assert = require("assert"),
  os = require("os").platform(),
  exec = require("child_process").exec,
  spawn = require("child_process").spawn,
  stream = require("stream"),
  testhelper = require("./helpers");

var testHTTP = "http://127.0.0.1:8090/test.mpg";
var testRTSP = "rtsp://127.0.0.1:5540/test-rtp.mpg";
var testRTPOut = "rtp://127.0.0.1:5540/input.mpg";

var divx_outopts = {
  f: "avi",
  "b:v": "1024k",
  "c:v": "mpeg4",
  vf: "scale=w=720:h=-1",
  "b:a": "128k",
  ac: 2,
  "c:a": "libmp3lame",
  vtag: "DIVX"
};
var podcast_outopts = {
  f: "m4v",
  "b:v": "512k",
  "c:v": "libx264",
  vf: "scale=w=320:h=176",
  "b:a": "128k",
  "c:a": "aac",
  ac: 1,
  flags: "+loop",
  cmp: "+chroma",
  partitions: "+parti4x4+partp8x8+partb8x8",
  flags2: "+mixed_refs",
  me_method: "umh",
  subq: 5,
  bufsize: "2M",
  rc_eq: "'blurCplx^(1-qComp)'",
  qcomp: 0.6,
  qmin: 10,
  qmax: 51,
  qdiff: 4,
  level: 13
};

/*****************************************************************

              IMPORTANT NOTE ABOUT PROCESSOR TESTS

 To ensure tests run reliably, you should do the following:

 * Any input file you use must be tested for existence before
   running the tests.  Use the 'prerequisite' function below and
   add any new file there.

 * FfmpegCommands should be created using 'this.getCommand(args)'
   in the test definition, not using 'new Ffmpegcommand(args)'.
   This enables ensuring the command is finished before starting
   the next test.

 * Any file your test is expected to create should have their full
   path pushed to the 'this.files' array in the test definition,
   and your test should *not* remove them on completion.  The
   cleanup hook will check all those files for existence and remove
   them.

 * Same thing with directories in the 'this.dirs' array.

 * If you use intervals or timeouts, please ensure they have been
   canceled (for intervals) or called (for timeouts) before
   calling the test 'done()' callback.

 Not abiding by those rules is BAD.  You have been warned :)

 *****************************************************************/

describe("Processor", function() {
  // check prerequisites once before all tests
  before(function prerequisites(done) {
    // check for ffmpeg installation
    this.testdir = path.join(__dirname, "assets");
    this.testfileName = "testvideo-43.avi";
    this.testfile = path.join(this.testdir, this.testfileName);
    this.testfilewide = path.join(this.testdir, "testvideo-169.avi");
    this.testfilebig = path.join(this.testdir, "testvideo-5m.mpg");
    this.testfileaudio1 = path.join(this.testdir, "testaudio-one.wav");
    this.testfileaudio2 = path.join(this.testdir, "testaudio-two.wav");
    this.testfileaudio3 = path.join(this.testdir, "testaudio-three.wav");

    // check if all test files exist
    [
      this.testfile,
      this.testfilewide,
      this.testfilebig,
      this.testfileaudio1,
      this.testfileaudio2,
      this.testfileaudio3
    ].forEach(file => {
      try {
        fs.accessSync(file);
      } catch {
        throw new Error(`test video file does not exist, check path (${file})`);
      }
    });
    done();
  });

  // cleanup helpers before and after all tests
  beforeEach(function setup(done) {
    var processes = (this.processes = []);
    var outputs = (this.outputs = []);

    // Tests should call this so that created processes are watched
    // for end and checked during test cleanup
    this.getCommand = function(...args) {
      var cmd = new FFmpeg(...args);
      cmd.on("start", function(proc) {
        processes.push(proc);

        // Remove process when it exits
        proc.on("exit", function(proc) {
          processes.splice(processes.indexOf(proc), 1);
        });
      });

      return cmd;
    };

    // Tests should call this to display stdout/stderr in case of error
    this.saveOutput = function(stdout, stderr) {
      outputs.unshift([stdout, stderr]);
    };

    this.files = [];
    this.dirs = [];

    done();
  });

  afterEach(function cleanup(done) {
    var self = this;

    async.series(
      [
        // Ensure every process has finished
        function(cb) {
          if (self.processes.length) {
            if (self.outputs.length) {
              testhelper.logOutput(self.outputs[0][0], self.outputs[0][1]);
            }

            self.test.error(
              new Error(
                self.processes.length +
                  ' processes still running after "' +
                  self.currentTest.title +
                  '"'
              )
            );
            cb();
          } else {
            cb();
          }
        },

        // Ensure all created files are removed
        function(cb) {
          async.each(
            self.files,
            function(file, cb) {
              fs.exists(file, function(exists) {
                if (exists) {
                  fs.unlink(file, cb);
                } else {
                  if (self.outputs.length) {
                    testhelper.logOutput(
                      self.outputs[0][0],
                      self.outputs[0][1]
                    );
                  }

                  self.test.error(
                    new Error(
                      "Expected created file " +
                        file +
                        ' by  "' +
                        self.currentTest.title +
                        '"'
                    )
                  );
                  cb();
                }
              });
            },
            cb
          );
        },

        // Ensure all created dirs are removed
        function(cb) {
          async.each(
            self.dirs,
            function(dir, cb) {
              fs.exists(dir, function(exists) {
                if (exists) {
                  fs.rmdir(dir, cb);
                } else {
                  if (self.outputs.length) {
                    testhelper.logOutput(
                      self.outputs[0][0],
                      self.outputs[0][1]
                    );
                  }

                  self.test.error(
                    new Error(
                      "Expected created directory " +
                        dir +
                        ' by  "' +
                        self.currentTest.title +
                        '"'
                    )
                  );
                  cb();
                }
              });
            },
            cb
          );
        }
      ],

      done
    );
  });

  describe("Process controls", function() {
    // it("should change the working directory", function(done) {
    //   var testFile = path.join(this.testdir, "testvideo.avi");
    //   this.files.push(testFile);

    //   this.getCommand({
    //     source: this.testfileName,
    //     logger: testhelper.logger,
    //     cwd: this.testdir
    //   })
    //     .usingPreset("divx")
    //     .on("error", function({stdout, stderr},err) {
    //       testhelper.logError({stdout, stderr},err);
    //       assert.ok(!err);
    //     })
    //     .on("end", function() {
    //       done();
    //     })
    //     .saveToFile(testFile);
    // });

    // timeout is not currently supported natively by node child_process.spawn
    // it("should kill the process on timeout", function(done) {
    //   var testFile = path.join(
    //     __dirname,
    //     "assets",
    //     "testProcessKillTimeout.avi"
    //   );
    //   this.files.push(testFile);

    //   var command = this.getCommand({
    //     inputs: [this.testfilebig],
    //     outputs: { url: testFile, options: divx_outopts },
    //     defaultSpawnOptions: { timeout: 1 }
    //     // logger: testhelper.logger,
    //   });
    //   var self = this;

    //   command
    //     .on("end", function() {
    //       done();
    //     })
    //     .on("error", function({ stdout, stderr }, err) {
    //       self.saveOutput(stdout, stderr);
    //       err.message.indexOf("timeout").should.not.equal(-1);
    //     })
    //     .on("end", function() {
    //       console.log("end was called, expected a timeout");
    //       assert.ok(false);
    //       done();
    //     });

    //   command.run();
    // });

    it("should not keep node process running on completion", function(done) {
      var script = `    
        const {FFmpeg} = require('.');
        const ffmpeg = new FFmpeg({
            inputs:{url:'${this.testfilebig}', options:{t:1}},
            outputs: {url: '/dev/null', options: {f:'null'}});
        ffmpeg.run();
      `;

      exec(`node -e "${script}"`, { timeout: 1000 }, done);
    });

    it("should kill the process with .kill", function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, "assets", "testProcessKill.avi");
      this.files.push(testFile);

      var ffmpegJob = this.getCommand({
        inputs: [this.testfilebig],
        outputs: { url: testFile, options: divx_outopts }
      });

      ffmpegJob
        .on("start", function(proc) {
          setTimeout(function() {
            proc.kill();
          }, 500);
        })
        .on("end", function(proc, code, signal) {
          signal.should.be.equal("SIGTERM");
          done();
        })
        .run();
    });

    it("should send the process custom signals with .kill(signal)", function(done) {
      this.timeout(60000);

      var testFile = path.join(
        __dirname,
        "assets",
        "testProcessKillCustom.avi"
      );
      this.files.push(testFile);

      var ffmpegJob = this.getCommand({
        inputs: [this.testfilebig],
        outputs: { url: testFile, options: divx_outopts }
        // logger: testhelper.logger,
        // timeout: 2
      });

      ffmpegJob
        .on("start", function(proc) {
          setTimeout(function() {
            proc.kill("SIGKILL");
          }, 500);
        })
        .on("end", function(proc, code, signal) {
          signal.should.be.equal("SIGKILL");
          done();
        })
        .run();
    });
  });

  describe("Events", function() {
    it("should report codec data through 'codecData' event", function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, "assets", "testOnCodecData.avi");
      this.files.push(testFile);

      let reported = false;
      this.getCommand({
        inputs: [this.testfilebig],
        outputs: { url: testFile, options: divx_outopts }
      })
        .on("codecData", function(proc, data) {
          data.should.have.properties(["inputs", "outputs"]);
          reported = true;
          proc.kill();
        })
        .on("end", function(proc, code, signal) {
          signal.should.be.ok();
          reported.should.be.true();
          done();
        })
        .run();
    });

    it("should report codec data through 'codecData' event on piped inputs", function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, "assets", "testOnCodecData.avi");
      this.files.push(testFile);

      let reported = false;
      this.getCommand({
        inputs: fs.createReadStream(this.testfilebig),
        outputs: { url: testFile, options: divx_outopts }
        // logger: testhelper.logger
      })
        .on("codecData", function(proc, data) {
          data.should.have.properties(["inputs", "outputs"]);
          reported = true;
          proc.stdin.end();
          proc.stdin.on("close", () => proc.kill());
        })
        .on("end", function(proc, code, signal) {
          signal.should.be.ok();
          reported.should.be.true();
          done();
        })
        .run();
    });

    it("should report codec data through 'codecData' for multiple inputs", function(done) {
      this.timeout(60000);
      let recorded = false;
      var testFile = path.join(__dirname, "assets", "testOnCodecData.wav");
      this.files.push(testFile);

      this.getCommand({
        inputs: [this.testfileaudio1, this.testfileaudio2],
        outputs: { url: testFile, options: { map: "[out]" } },
        global: {
          filter_complex: "[0:0] [1:0] concat=v=0:a=1 [out]"
        }
        // logger: testhelper.logger
      })
        .on("codecData", function(proc, data) {
          data.should.have.property("inputs");
          data.inputs.should.have.length(2);
          recorded = true;
          proc.kill();
        })
        .on("end", function() {
          recorded.should.be.true();
          done();
        })
        .run();
    });

    it("should report progress through 'progress' event", function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, "assets", "testOnProgress.avi");
      var gotProgress = false;

      this.files.push(testFile);

      this.getCommand({
        inputs: this.testfilebig,
        outputs: { url: testFile, options: divx_outopts }
      })
        .on("progress", function() {
          gotProgress = true;
        })
        .on("end", function() {
          gotProgress.should.be.true();
          done();
        })
        .run();
    });

    it("should report start of ffmpeg process through 'start' event", function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, "assets", "testStart.avi");

      this.files.push(testFile);
      const cmd = this.getCommand({
        inputs: this.testfilebig,
        outputs: { url: testFile, options: divx_outopts }
      });
      let pstart;
      cmd
        .on("start", function(proc) {
          pstart = proc;
        })
        .on("end", function(proc) {
          proc.should.equal(pstart);
          done();
        })
        .run();
    });

    //   describe("takeScreenshots", function() {
    //     function testScreenshots(title, name, config, files) {
    //       it(title, function(done) {
    //         var filenamesCalled = false;
    //         var testFolder = path.join(__dirname, "assets", "screenshots_" + name);

    //         var context = this;
    //         files.forEach(function(file) {
    //           context.files.push(path.join(testFolder, file));
    //         });
    //         this.dirs.push(testFolder);

    //         this.getCommand({ source: this.testfile, logger: testhelper.logger })
    //           .on("error", function({stdout, stderr},err) {
    //             // testhelper.logError({stdout, stderr},err);
    //             assert.ok(!err);
    //           })
    //           .on("filenames", function(filenames) {
    //             filenamesCalled = true;
    //             filenames.length.should.equal(files.length);
    //             filenames.forEach(function(file, index) {
    //               file.should.equal(files[index]);
    //             });
    //           })
    //           .on("end", function() {
    //             filenamesCalled.should.equal(true);
    //             fs.readdir(testFolder, function(err, content) {
    //               var tnCount = 0;
    //               content.forEach(function(file) {
    //                 if (file.indexOf(".png") > -1) {
    //                   tnCount++;
    //                 }
    //               });
    //               tnCount.should.equal(files.length);
    //               files.forEach(function(file) {
    //                 content.indexOf(file).should.not.equal(-1);
    //               });
    //               done();
    //             });
    //           })
    //           .takeScreenshots(config, testFolder);
    //       });
    //     }

    //     testScreenshots(
    //       "should take screenshots from a list of number timemarks",
    //       "timemarks_num",
    //       { timemarks: [0.5, 1] },
    //       ["tn_1.png", "tn_2.png"]
    //     );

    //     testScreenshots(
    //       "should take screenshots from a list of string timemarks",
    //       "timemarks_string",
    //       { timemarks: ["0.5", "1"] },
    //       ["tn_1.png", "tn_2.png"]
    //     );

    //     testScreenshots(
    //       "should take screenshots from a list of string timemarks",
    //       "timemarks_hms",
    //       { timemarks: ["00:00:00.500", "00:01"] },
    //       ["tn_1.png", "tn_2.png"]
    //     );

    //     testScreenshots(
    //       'should support "timestamps" instead of "timemarks"',
    //       "timestamps",
    //       { timestamps: [0.5, 1] },
    //       ["tn_1.png", "tn_2.png"]
    //     );

    //     testScreenshots(
    //       "should replace %i with the screenshot index",
    //       "filename_i",
    //       { timemarks: [0.5, 1], filename: "shot_%i.png" },
    //       ["shot_1.png", "shot_2.png"]
    //     );

    //     testScreenshots(
    //       "should replace %000i with the padded screenshot index",
    //       "filename_0i",
    //       { timemarks: [0.5, 1], filename: "shot_%000i.png" },
    //       ["shot_0001.png", "shot_0002.png"]
    //     );

    //     testScreenshots(
    //       "should replace %s with the screenshot timestamp",
    //       "filename_s",
    //       { timemarks: [0.5, "40%", 1], filename: "shot_%s.png" },
    //       ["shot_0.5.png", "shot_0.8.png", "shot_1.png"]
    //     );

    //     testScreenshots(
    //       "should replace %f with the input filename",
    //       "filename_f",
    //       { timemarks: [0.5, 1], filename: "shot_%f_%i.png" },
    //       ["shot_testvideo-43.avi_1.png", "shot_testvideo-43.avi_2.png"]
    //     );

    //     testScreenshots(
    //       "should replace %b with the input basename",
    //       "filename_b",
    //       { timemarks: [0.5, 1], filename: "shot_%b_%i.png" },
    //       ["shot_testvideo-43_1.png", "shot_testvideo-43_2.png"]
    //     );

    //     testScreenshots(
    //       "should replace %r with the output resolution",
    //       "filename_r",
    //       { timemarks: [0.5, 1], filename: "shot_%r_%i.png" },
    //       ["shot_1024x768_1.png", "shot_1024x768_2.png"]
    //     );

    //     testScreenshots(
    //       "should replace %w and %h with the output resolution",
    //       "filename_wh",
    //       { timemarks: [0.5, 1], filename: "shot_%wx%h_%i.png" },
    //       ["shot_1024x768_1.png", "shot_1024x768_2.png"]
    //     );

    //     testScreenshots(
    //       "should automatically add %i when no variable replacement is present",
    //       "filename_add_i",
    //       { timemarks: [0.5, 1], filename: "shot_%b.png" },
    //       ["shot_testvideo-43_1.png", "shot_testvideo-43_2.png"]
    //     );

    //     testScreenshots(
    //       'should automatically compute timestamps from the "count" option',
    //       "count",
    //       { count: 3, filename: "shot_%s.png" },
    //       ["shot_0.5.png", "shot_1.png", "shot_1.5.png"]
    //     );

    //     testScreenshots(
    //       "should enable setting screenshot size",
    //       "size",
    //       { count: 3, filename: "shot_%r.png", size: "150x?" },
    //       ["shot_150x112_1.png", "shot_150x112_2.png", "shot_150x112_3.png"]
    //     );

    //     testScreenshots(
    //       "a single screenshot should not have a _1 file name suffix",
    //       "no_suffix",
    //       { timemarks: [0.5] },
    //       ["tn.png"]
    //     );
    //   });

    describe("saveToFile", function() {
      it("should save the output file properly to disk", function(done) {
        var testFile = path.join(__dirname, "assets", "testConvertToFile.avi");
        this.files.push(testFile);

        this.getCommand({
          inputs: this.testfile,
          outputs: { url: testFile, options: divx_outopts }
        })
          .on("error", function({ stdout, stderr }, err) {
            console.error(err.log);
            assert.ok(!err);
          })
          .on("end", function() {
            fs.exists(testFile, function(exist) {
              exist.should.equal(true);
              // check filesize to make sure conversion actually worked
              fs.stat(testFile, function(err, stats) {
                assert.ok(!err && stats);

                stats.size.should.above(0);
                stats.isFile().should.equal(true);

                done();
              });
            });
          })
          .run();
      });

      it("should accept a stream as its source", function(done) {
        var testFile = path.join(
          __dirname,
          "assets",
          "testConvertFromStreamToFile.avi"
        );
        this.files.push(testFile);

        var instream = fs.createReadStream(this.testfile);
        this.getCommand({
          inputs: instream,
          outputs: { url: testFile, options: divx_outopts }
        })
          .on("error", function({ stdout, stderr }, err) {
            console.error(err.log);
            assert.ok(!err);
          })
          .on("end", function() {
            fs.exists(testFile, function(exist) {
              exist.should.equal(true);
              // check filesize to make sure conversion actually worked
              fs.stat(testFile, function(err, stats) {
                assert.ok(!err && stats);
                stats.size.should.above(0);
                stats.isFile().should.equal(true);

                done();
              });
            });
          })
          .run();
      });

      it("should pass input stream errors through to error handler", function(done) {
        var testFile = path.join(
          __dirname,
          "assets",
          "testConvertFromStream.avi"
        );

        const readError = new Error("Read Error");
        const instream = new (require("stream").Readable)({
          read() {
            process.nextTick(() => this.emit("error", readError));
          }
        });

        let error_event = false;

        const command = this.getCommand({
          inputs: instream,
          outputs: { url: testFile, options: divx_outopts }
        })
          .on("error", function(proc, err) {
            err.message.should.be.equal("Input stream error: Read Error");
            error_event = true;
          })
          .on("end", function(proc, code, signal) {
            fs.existsSync(testFile).should.be.false();
            error_event.should.be.true();
            done();
          })
          .run();
      });
    });

    describe("mergeToFile", function() {
      it("should merge multiple files", function(done) {
        var testFile = path.join(__dirname, "assets", "testMergeAddOption.wav");
        this.files.push(testFile);

        this.getCommand({
          inputs: [
            this.testfileaudio1,
            this.testfileaudio2,
            this.testfileaudio3
          ],
          outputs: { url: testFile, options: { map: "[out]" } },
          global: {
            filter_complex: "[0:0] [1:0] [2:0] concat=n=3:v=0:a=1 [out]"
          }
        })
          .on("error", function({ stdout, stderr }, err) {
            console.error(err.log);
            if (err) console.error(err.log);
            assert.ok(!err);
          })
          .on("end", function() {
            fs.exists(testFile, function(exist) {
              exist.should.equal(true);
              // check filesize to make sure conversion actually worked
              fs.stat(testFile, function(err, stats) {
                assert.ok(!err && stats);
                stats.size.should.above(0);
                stats.isFile().should.equal(true);

                done();
              });
            });
          })
          .run();
      });
    });

    describe("writeToStream", function() {
      describe("should save the output file properly to disk using a stream", function() {
        it("...and close the stream when completed by default", function(done) {
          let testFile = path.join(
            __dirname,
            "assets",
            "testConvertToStream.avi"
          );
          this.files.push(testFile);
          let outstream = fs.createWriteStream(testFile);
          this.getCommand({
            inputs: this.testfile,
            outputs: { url: outstream, options: divx_outopts }
          })
            .on("error", function({ stdout, stderr }, err) {
              console.error(err.log);
              assert.ok(!err);
            })
            .on("end", function({ stdout, stderr }) {
              outstream.writableEnded.should.be.true();
              const stats = fs.statSync(testFile);
              stats.should.be.ok();
              stats.size.should.be.above(0);
              stats.isFile().should.be.true();
              done();
            })
            .run();
        });

        it("...and keep the stream open if 'keepopen' output option is specified", function(done) {
          let testFile = path.join(
            __dirname,
            "assets",
            "testConvertToStream.avi"
          );
          this.files.push(testFile);
          let outstream = fs.createWriteStream(testFile);
          this.getCommand({
            inputs: this.testfile,
            outputs: {
              url: outstream,
              options: { ...divx_outopts, keepopen: null }
            }
          })
            .on("error", function({ stdout, stderr }, err) {
              console.error(err.log);
              assert.ok(!err);
            })
            .on("end", function({ stdout, stderr }) {
              outstream.writableEnded.should.be.false();
              outstream.end();
              const stats = fs.statSync(testFile);
              stats.should.be.ok();
              stats.size.should.be.above(0);
              stats.isFile().should.be.true();
              done();
            })
            .run();
        });
      });
      it("should accept a stream as its source", function(done) {
        var testFile = path.join(
          __dirname,
          "assets",
          "testConvertFromStreamToStream.avi"
        );
        this.files.push(testFile);

        var instream = fs.createReadStream(this.testfile);
        var outstream = fs.createWriteStream(testFile);

        this.getCommand({
          inputs: instream,
          outputs: { url: outstream, options: divx_outopts }
        })
          .on("error", function({ stdout, stderr }, err) {
            console.error(err.log);
            assert.ok(!err);
          })
          .on("end", function({ stdout, stderr }) {
            fs.exists(testFile, function(exist) {
              if (!exist) {
                console.log(stderr);
              }

              exist.should.equal(true);
              // check filesize to make sure conversion actually worked
              fs.stat(testFile, function(err, stats) {
                assert.ok(!err && stats);
                stats.size.should.above(0);
                stats.isFile().should.equal(true);

                done();
              });
            });
          })
          .run();
      });

      it("should pass output stream errors through to error handler", function(done) {
        const writeError = new Error("Write Error");
        const outstream = new (require("stream").Writable)({
          write(chunk, encoding, callback) {
            callback(writeError);
          }
        });

        const command = this.getCommand({
          inputs: this.testfile,
          outputs: { url: outstream, options: divx_outopts }
        });

        let error_event = false;

        command
          .on("error", function(proc, err) {
            err.message.should.be.equal("Output stream error: Write Error");
            error_event = true;
          })
          .on("end", function(proc, code, signal) {
            error_event.should.be.true();
            done();
          })
          .run();
      });
    });

    describe("Outputs", function() {
      it("should create multiple outputs", function(done) {
        this.timeout(30000);

        var testFile1 = path.join(
          __dirname,
          "assets",
          "testMultipleOutput1.avi"
        );
        this.files.push(testFile1);
        var testFile2 = path.join(
          __dirname,
          "assets",
          "testMultipleOutput2.avi"
        );
        this.files.push(testFile2);
        var testFile3 = path.join(
          __dirname,
          "assets",
          "testMultipleOutput3.mp4"
        );
        this.files.push(testFile3);

        this.getCommand({
          inputs: this.testfilebig,
          outputs: [
            {
              url: testFile1,
              options: {
                "c:a": "libvorbis",
                "c:v": "copy"
              }
            },
            {
              url: testFile2,
              options: {
                "c:a": "libmp3lame",
                "c:v": "copy"
              }
            },
            {
              url: testFile3,
              options: {
                "c:a": "aac",
                "c:v": "libx264",
                vf: "scale=w=160:h=120"
              }
            }
          ]
        })
          .on("error", function({ stdout, stderr }, err) {
            console.error(err.log);
            assert.ok(!err);
          })
          .on("end", function() {
            async.map(
              [testFile1, testFile2, testFile3],
              function(file, cb) {
                fs.exists(file, function(exist) {
                  exist.should.equal(true);

                  // check filesize to make sure conversion actually worked
                  fs.stat(file, function(err, stats) {
                    assert.ok(!err && stats);
                    stats.size.should.above(0);
                    stats.isFile().should.equal(true);

                    cb(err);
                  });
                });
              },
              function(err) {
                //   testhelper.logError(err);
                assert.ok(!err);
                done();
              }
            );
          })
          .run();
      });
    });

    describe.skip("Remote I/O", function() {
      this.timeout(60000);

      var ffserver;

      before(function(done) {
        console.log("spawning ffserver");
        ffserver = spawn(
          "ffserver",
          ["-d", "-f", path.join(__dirname, "assets", "ffserver.conf")],
          { cwd: path.join(__dirname, "assets") }
        );

        // Wait for ffserver to be ready
        var isready = false;
        function ready() {
          if (!isready) {
            testhelper.logger.debug("ffserver is ready");
            isready = true;
            done();
          }
        }

        ffserver.stdout.on("data", function(d) {
          if (d.toString().match(/server started/i)) {
            ready();
          }
        });

        ffserver.stderr.on("data", function(d) {
          if (d.toString().match(/server started/i)) {
            ready();
          }
        });
      });

      beforeEach(function(done) {
        setTimeout(done, 5000);
      });

      after(function(done) {
        ffserver.kill();
        setTimeout(done, 1000);
      });

      it("should take input from a RTSP stream", function(done) {
        var testFile = path.join(__dirname, "assets", "testRTSPInput.avi");
        this.files.push(testFile);

        this.getCommand({
          source: encodeURI(testRTSP),
          outputs: {
            url: testFile,
            options: { ...divx_outopts, t: 1, vf: "scale=w=320:h=240" }
          }
        })
          .on("error", function({ stdout, stderr }, err) {
            console.error(err.log);
            assert.ok(!err);
          })
          .on("end", function() {
            fs.exists(testFile, function(exist) {
              exist.should.equal(true);
              // check filesize to make sure conversion actually worked
              fs.stat(testFile, function(err, stats) {
                assert.ok(!err && stats);
                stats.size.should.above(0);
                stats.isFile().should.equal(true);

                done();
              });
            });
          })
          .run();
      });

      it("should take input from an URL", function(done) {
        var testFile = path.join(__dirname, "assets", "testURLInput.avi");
        this.files.push(testFile);

        this.getCommand({
          inputs: testHTTP,
          outputs: {
            url: testFile,
            options: { ...divx_outopts, t: 1, vf: "scale=w=320:h=240" }
          }
        })
          .on("error", function({ stdout, stderr }, err) {
            console.error(err.log);
            assert.ok(!err);
          })
          .on("end", function() {
            fs.exists(testFile, function(exist) {
              exist.should.equal(true);
              // check filesize to make sure conversion actually worked
              fs.stat(testFile, function(err, stats) {
                assert.ok(!err && stats);
                stats.size.should.above(0);
                stats.isFile().should.equal(true);

                done();
              });
            });
          })
          .run();
      });

      it("should output to a RTP stream", function(done) {
        this.getCommand({
          inputs: this.testfilebig,
          outputs: {
            url: testRTPOut,
            options: { "c:v": "libx264", "c:a": "copy" }
          }
        })
          .on("error", function({ stdout, stderr }, err) {
            console.error(err.log);
            assert.ok(!err);
          })
          .on("end", function() {
            done();
          })
          .run();
      });
    });

    describe("Errors", function() {
      it("should report an error when ffmpeg has been killed", function(done) {
        this.timeout(10000);

        var testFile = path.join(__dirname, "assets", "testErrorKill.avi");
        this.files.push(testFile);
        let errored = false;
        var command = this.getCommand({
          inputs: this.testfilebig,
          outputs: { url: testFile, options: divx_outopts }
        })
          .on("start", function() {
            setTimeout(function() {
              command.kill("SIGKILL");
            }, 1000);
          })
          .on("error", function(proc, err) {
            err.message.should.match(
              /FFmpeg was terminated with signal SIGKILL/
            );
            errored = true;
          })
          .on("end", function() {
            errored.should.be.true();
            done();
          })
          .run();
      });

      it("should report ffmpeg errors", function(done) {
        let errored = false;
        this.getCommand({
          inputs: this.testfilebig,
          outputs: "/will/not/be/created/anyway",
          global: ["invalidoption"]
        })
          .on("error", function(proc, err) {
            err.message.should.match(
              /Error splitting the argument list: Option not found\r\n/
            );
            errored = true;
          })
          .on("end", () => (errored.should.be.true(), done()))
          .run();
      });
    });
  });
});
