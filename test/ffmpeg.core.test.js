"use strict";

const { FFmpeg } = require("../index");
const path = require("path");
const process = require("process");
const { spawnSync, exec } = require("child_process");

describe("FFmpeg Core Functions", function () {
  describe("FFmpeg path", function () {
    const origCmd = FFmpeg.command;
    if (process.env.FFMPEG_PATH)
      it("should use the path specified by FFMPEG_PATH system environment variable", function (done) {
        FFmpeg.command.startsWith(process.env.FFMPEG_PATH).should.equal(true);
        done();
      });
    it("should allow manual definition of FFmpeg binary path", function (done) {
      const p = "custom_path/ffmpeg";
      FFmpeg.command = p;
      FFmpeg.command.should.equal(p);
      done();
    });

    it("should allow to revert to the default FFmpeg binary path by setting cmd to falsy", function (done) {
      FFmpeg.command = null;
      FFmpeg.command.should.equal(origCmd);
      done();
    });
  });

  describe("FFmpeg basic usage:", function () {
    // get -version output as the
    const args = ["-version"];
    const verOut = spawnSync(FFmpeg.command, args, { encoding: "utf8" }).stdout;
    it("Use FFmpeg.spawn() for async execution of FFmpeg", function (done) {
      const proc = FFmpeg.spawn(args, { encoding: "utf8" });
      let buf = "";
      proc.stdout.on("data", chunk => {
        buf += chunk;
      });
      proc.on("close", code => {
        code.should.equal(0);
        buf.should.equal(verOut);
        done();
      });
    });
    it("FFmpeg.spawn() should not keep node process running on completion", function (done) {
      var script = `    
        const {FFmpeg} = require('.');
        FFmpeg.spawn(['-version']);
      `;

      exec(`node -e "${script}"`, { timeout: 1000 }, done);
    });
    it("Use FFmpeg.spawnSync() for synchronous execution of FFmpeg", function (done) {
      const ret = FFmpeg.spawnSync(args, { encoding: "utf8" });
      ret.status.should.equal(0);
      ret.stdout.should.equal(verOut);
      done();
    });
    it("Use FFmpeg.spawnSyncUtf8() for synchronous execution of FFmpeg and get stdout and stderr in utf8 encoded String", function (done) {
      const ret = FFmpeg.spawnSyncUtf8(args);
      ret.status.should.equal(0);
      ret.stdout.should.equal(verOut);
      done();
    });
    it("Use FFmpeg.version to get the FFmpeg version", function (done) {
      const ver = FFmpeg.version;
      (typeof ver).should.equal("string");
      done();
    });
  });
});
