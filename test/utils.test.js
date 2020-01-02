/*jshint node:true*/
/*global describe,it*/
"use strict";

var utils = require("../lib/utils");

describe("Utilities", () => {
  describe("strsignal()", () => {
    it("should convert 15 to SIGNTERM", done => {
      utils.strsignal(15).should.be.equal("SIGTERM");
      done();
    });
    (process.platform === "win32" ? it.skip : it)("should convert 9 to SIGKILL", done => {
      utils.strsignal(9).should.be.equal("SIGKILL");
      done();
    });
    it("should convert 2 to SIGKINT", done => {
      utils.strsignal(2).should.be.equal("SIGINT");
      done();
    });
  });
  describe("parseOpts()", () => {
    it("should parse cli key-value option string", done => {
      let opts = utils.parseOpts("-i video.mp4");
      opts.should.have.property("i");
      opts.i.should.be.equal("video.mp4");
      done();
    });
    it("should parse cli key-only option string", done => {
      let opts = utils.parseOpts("-hide_banner");
      opts.should.have.property("hide_banner");
      should(opts.hide_banner).not.be.ok();
      done();
    });
    it("should recognize cli key-value option string with negative option value", done => {
      let opts = utils.parseOpts("-s -0.5");
      opts.should.have.property("s");
      opts.s.should.be.equal("-0.5");
      done();
    });
    it("should combine repeated keys and return their values as an array in the order of appearance", done => {
      let opts = utils.parseOpts("-m v -m 0:1 -m 4");
      opts.should.have.property("m");
      opts.m.should.containDeepOrdered(["v", "0:1", "4"]);
      done();
    });
    it("should parse cli strings with multiple options", done => {
      let opts = utils.parseOpts("-i video.mp4 -hide_banner");
      opts.should.have.properties(["i", "hide_banner"]);
      opts.should.have.property("i");
      opts.i.should.be.deepEqual("video.mp4");
      should(opts.hide_banner).not.be.ok();

      opts = utils.parseOpts("-i input.webm -qscale 0");
      opts.should.have.properties(["i", "qscale"]);
      opts.i.should.be.equal("input.webm");
      opts.qscale.should.be.equal("0");

      opts = utils.parseOpts(
        "-i input.mp4 -vn -ar 44100 -a:c 2 -ab 320 -f mp3"
      );
      opts.should.have.properties(["i", "vn", "ar", "a:c", "ab", "f"]);
      opts.i.should.be.equal("input.mp4");
      should(opts.vn).not.be.ok();
      opts.ar.should.be.equal("44100");
      opts["a:c"].should.be.equal("2");
      opts.ab.should.be.equal("320");
      opts.f.should.be.equal("mp3");

      done();
    });
  });
  describe("opts2args()", () => {
    it("should convert option object to argument array", done => {
      let args = utils.opts2args({
        i: "input.mp4",
        vn: null,
        ar: 44100,
        "a:c": 2,
        ab: 320,
        f: "mp3"
      });
      args.should.containDeepOrdered([
        "-i",
        "input.mp4",
        "-vn",
        "-ar",
        "44100",
        "-a:c",
        "2",
        "-ab",
        "320",
        "-f",
        "mp3"
      ]);
      done();
    });
    it("should create repeated option arguments if option values are given as an array", done => {
      let args = utils.opts2args({ m: ["v", "0:1", "4"] });
      args.should.containDeepOrdered(["-m", "v", "-m", "0:1", "-m", "4"]);
      done();
    });
    it("should accept an string array of value-less options", done => {
      let args = utils.opts2args(["n", "hide_banner", "show_streams"]);
      args.should.containDeepOrdered(["-n", "-hide_banner", "-show_streams"]);
      done();
    });
    it("should accept arguments", done => {
      let inp = "-i input.mp4 -vn -ar 44100 -a:c 2 -ab 320 -f mp3";
      let args = utils.opts2args(inp);
      args.should.containDeepOrdered(inp.split(" "));
      done();
    });
    describe("should accept def options arguments...", () => {
      it("...given String input", done => {
        let inp = "-i input.mp4";
        let opts = { def: { dn: null } };
        let args = utils.opts2args(inp, opts);
        args.should.containDeepOrdered(["-dn", "-i", "input.mp4"]);
        done();
      });
      it("...given Object input", done => {
        let inp = { i: "input.mp4" };
        let opts = { def: { dn: null } };
        let args = utils.opts2args(inp, opts);
        args.should.containDeepOrdered(["-dn", "-i", "input.mp4"]);
        done();
      });
      it("...which may be overwritten by user input", done => {
        let inp = { i: "input.mp4" };
        let opts = { def: { i: "default.mp4" } };
        let args = utils.opts2args(inp, opts);
        args.should.containDeepOrdered(["-i", "input.mp4"]);
        done();
      });
    });
    describe("should accept fixed options arguments...", () => {
      it("...which acts like default arguments", done => {
        let inp = { i: "input.mp4" };
        let opts = { fixed: { "c:a": "libmp3lame" } };
        let args = utils.opts2args(inp, opts);
        args.should.containDeepOrdered([
          "-c:a",
          "libmp3lame",
          "-i",
          "input.mp4"
        ]);
        done();
      });
      it("...unless user tries to override it (throws)", done => {
        let inp = { i: "input.mp4", "c:a": "libmp3lame" };
        let opts = { fixed: { "c:a": "libmp3lame" } };
        (() => utils.opts2args(inp, opts)).should.throw();
        done();
      });
    });
    it("should accept ignore options arguments to drop user inputs", done => {
      let inp = { i: "input.mp4", "c:a": "libmp3lame" };
      let opts = { ignore: ["c:a"] };
      let args = utils.opts2args(inp, opts);
      args.should.containDeepOrdered(["-i", "input.mp4"]);
      done();
    });
    it("should accept error options arguments to error out if matched user input given", done => {
      let inp = { i: "input.mp4", "c:a": "libmp3lame" };
      let opts = { error: ["c:a"] };
      (() => utils.opts2args(inp, opts)).should.throw();
      done();
    });
    it("should accept specs options arguments to set special function", done => {
      let inp = { i: "input.mp4", "c:a": "libmp3lame" };
      let opts = {
        def: { ac: "aac" },
        spec: {
          "c:a": (opts, key, val) => {
            if ("ac" in opts) delete opts.ac;
            opts[key] = val;
          }
        }
      };
      let args = utils.opts2args(inp, opts);
      args.should.containDeepOrdered(["-i", "input.mp4", "-c:a", "libmp3lame"]);
      done();
    });
    describe("should accept starting arguments array to build on...", () => {
      it("...given standard Object options input", done => {
        let inp = { i: "input.mp4" };
        let args = ["-vn", "-an"];
        args = utils.opts2args(inp, {}, args);
        args.should.containDeepOrdered(["-vn", "-an", "-i", "input.mp4"]);
        done();
      });
      it("...given no-valued options string array", done => {
        let inp = ["vn", "an"];
        let args = ["-i", "input.mp4"];
        args = utils.opts2args(inp, {}, args);
        args.should.containDeepOrdered(["-i", "input.mp4", "-vn", "-an"]);
        done();
      });
    });
  });
});
