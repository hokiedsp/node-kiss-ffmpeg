/*jshint node:true*/
/*global describe,it,before*/
"use strict";

var { ffprobe, ffprobeSync } = require("../index"),
  path = require("path"),
  fs = require("fs");

describe("FFprobe Functions", function() {
  it("The API should provide ffprobe and ffprobeSync functions", function(done) {
    ffprobe.should.be.Function();
    ffprobeSync.should.be.Function();
    done();
  });
  describe("FFprobe binary path", function() {
    it("should be found on system Path, FFPROBE_PATH, or FFMPEG_PAT", function(done) {
      ffprobeSync();
      done();
    });
    it("should be user-specifiable via 'command' option", function(done) {
      const command = "custom_path";
      try {
        ffprobeSync("", { command });
      } catch (err) {
        err.path.should.equal(command);
        done();
      }
      throw Error("Shouldn't reach this far.");
      done();
    });
  });

  describe("ffprobe() and ffprobeSync()", function() {
    describe("should produce...", function(done) {
      it("identical outputs", function(done) {
        const data = ffprobeSync();
        ffprobe()
          .then(asyncData => {
            asyncData.should.deepEqual(data);
            done();
          })
          .should.be.fulfilled();
      });

      it("and idential errors", function(done) {
        const opts = { not: "a option" };
        let errSync;
        try {
          ffprobeSync("", opts);
          throw Error("Should not reach here.");
        } catch (err) {
          errSync = String(err);
        }
        ffprobe("", opts)
          .catch(err => {
            String(err).should.deepEqual(errSync);
            done();
          })
          .should.be.rejected()
          .catch(() => {});
      });
    });

    it("should protect print_format option", function(done) {
      (() => ffprobeSync("", { print_format: "csv" })).should.throw();
      done();
    });

    describe("without (or empty) url argument", function(done) {
      it("should return program & library versions by default", function(done) {
        const vers = ffprobeSync();
        vers.should.be.Object();
        vers.should.have.properties(["program_version", "library_versions"]);
        done();
      });
      it("should accept non-url dependent option", function(done) {
        ffprobeSync("", ["show_pixel_formats"]).should.have.property(
          "pixel_formats"
        );
        done();
      });
      it("should accept 'hide_versions' option to disable the default behavior", function(done) {
        ffprobe("", ["hide_versions"])
          .should.be.rejected()
          .finally(() => done());
      });
    });
    describe("with (non-empty) url argument", function() {
      before(function(done) {
        // check for ffmpeg installation
        this.testfile = path.join(__dirname, "assets", "testvideo-43.avi");

        var self = this;
        // check if file exists
        try {
          fs.accessSync(self.testfile);
          done();
        } catch {
          new Error(
            "test video file does not exist, check path (" + self.testfile + ")"
          );
        }
      });

      it("should return format, streams, programs, and chapters information by default", function(done) {
        let data = ffprobeSync(this.testfile);
        data.should.be.Object();
        data.should.have.properties([
          "format",
          "streams",
          "programs",
          "chapters"
        ]);
        done();
      });

      it("should accept a valid ffprobe option", function(done) {
        ffprobeSync(this.testfile, [
          "show_program_version"
        ]).should.have.property("program_version");
        done();
      });

      it("should accept 'hide_all' no-argument option to suppress default show selection", function(done) {
        let data = ffprobeSync(this.testfile, ["hide_all", "show_streams"]);
        data.should.not.have.properties(["format", "programs", "chapters"]);
        data.should.have.properties(["streams"]);
        done();
      });

      it("should accept 'hide_format' no-argument option to suppress hide format information", function(done) {
        let data = ffprobeSync(this.testfile, ["hide_format"]);
        data.should.not.have.properties(["format"]);
        data.should.have.properties(["streams", "programs", "chapters"]);
        done();
      });

      it("should accept 'hide_streams' no-argument option to suppress hide streams information", function(done) {
        let data = ffprobeSync(this.testfile, ["hide_streams"]);
        data.should.not.have.properties(["streams"]);
        data.should.have.properties(["format", "programs", "chapters"]);
        done();
      });

      it("should accept 'hide_programs' no-argument option to suppress hide programs information", function(done) {
        let data = ffprobeSync(this.testfile, ["hide_programs"]);
        data.should.not.have.properties(["programs"]);
        data.should.have.properties(["format", "streams", "chapters"]);
        done();
      });

      it("should accept 'hide_chapters' no-argument option to suppress hide chapters information", function(done) {
        let data = ffprobeSync(this.testfile, ["hide_chapters"]);
        data.should.not.have.properties(["chapters"]);
        data.should.have.properties(["format", "streams", "programs"]);
        done();
      });
    });
  });
});
