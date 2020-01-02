/*jshint node:true*/
/*global describe,it,beforeEach,afterEach,after*/

"use strict";

const { FFmpeg } = require("../index");
const path = require("path");

describe("Capabilities", function() {
  describe("FFmpeg capabilities", function() {
    const checkCoders = coders => {
      (typeof coders).should.equal("object");
      const keys = Object.keys(coders);
      keys.length.should.not.equal(0);
      const coder = coders[keys[0]];
      ("type" in coder).should.equal(true);
      (typeof coder.type).should.equal("string");
      ("description" in coder).should.equal(true);
      (typeof coder.description).should.equal("string");
      ("frameMT" in coder).should.equal(true);
      (typeof coder.frameMT).should.equal("boolean");
      ("sliceMT" in coder).should.equal(true);
      (typeof coder.sliceMT).should.equal("boolean");
      ("experimental" in coder).should.equal(true);
      (typeof coder.experimental).should.equal("boolean");
      ("drawHorizBand" in coder).should.equal(true);
      (typeof coder.drawHorizBand).should.equal("boolean");
      ("directRendering" in coder).should.equal(true);
      (typeof coder.directRendering).should.equal("boolean");
    };
    const checkFormats = (formats, doCan) => {
      (typeof formats).should.equal("object");
      const keys = Object.keys(formats);
      keys.length.should.not.equal(0);
      const format = formats[keys[0]];
      ("description" in format).should.equal(true);
      (typeof format.description).should.equal("string");
      if (doCan) {
        ("canDemux" in format).should.equal(true);
        (typeof format.canDemux).should.equal("boolean");
        ("canMux" in format).should.equal(true);
        (typeof format.canMux).should.equal("boolean");
      }
    };
    const checkStringArray = list => {
      Array.isArray(list).should.equal(true);
      list.forEach(val => {
        (typeof val).should.equal("string");
        val.length.should.not.equal(0);
      });
    };

    it("should enable querying for available formats", function(done) {
      checkFormats(FFmpeg.formats, true);
      done();
    });

    it("should enable querying for available demuxers", function(done) {
      checkFormats(FFmpeg.demuxers, false);
      done();
    });

    it("should enable querying for available muxers", function(done) {
      checkFormats(FFmpeg.muxers, false);
      done();
    });

    it("should enable querying for available devices", function(done) {
      checkFormats(FFmpeg.devices, true);
      done();
    });

    it("should enable querying for available codecs", function(done) {
      const codecs = FFmpeg.codecs;

      (typeof codecs).should.equal("object");
      const keys = Object.keys(codecs);
      keys.length.should.not.equal(0);
      const key = keys[0];

      ("type" in codecs[key]).should.equal(true);
      (typeof codecs[key].type).should.equal("string");
      ("description" in codecs[key]).should.equal(true);
      (typeof codecs[key].description).should.equal("string");
      ("canEncode" in codecs[key]).should.equal(true);
      (typeof codecs[key].canEncode).should.equal("boolean");
      ("canDecode" in codecs[key]).should.equal(true);
      (typeof codecs[key].canDecode).should.equal("boolean");
      ("intraFrameOnly" in codecs[key]).should.equal(true);
      (typeof codecs[key].intraFrameOnly).should.equal("boolean");
      ("isLossy" in codecs[key]).should.equal(true);
      (typeof codecs[key].isLossy).should.equal("boolean");
      ("isLossless" in codecs[key]).should.equal(true);
      (typeof codecs[key].isLossless).should.equal("boolean");

      done();
    });

    it("should enable querying for available encoders", function(done) {
      checkCoders(FFmpeg.encoders);
      done();
    });

    it("should enable querying for available decoders", function(done) {
      checkCoders(FFmpeg.decoders);
      done();
    });

    it("should enable querying for available bitstream filters", function(done) {
      checkStringArray(FFmpeg.bsfs);
      done();
    });

    it("should enable querying for available protocols", function(done) {
      const protocols = FFmpeg.protocols;
      (typeof protocols).should.equal("object");
      ["input", "output"].forEach(type =>
        Object.keys(protocols).should.containEql(type)
      );
      checkStringArray(protocols.input);
      checkStringArray(protocols.output);
      done();
    });

    it("should enable querying for available filters", function(done) {
      const filters = FFmpeg.filters;

      (typeof filters).should.equal("object");
      const keys = Object.keys(filters);
      keys.length.should.not.equal(0);
      const filter = filters[keys[0]];
      ("description" in filter).should.equal(true);
      (typeof filter.description).should.equal("string");
      ("input" in filter).should.equal(true);
      (typeof filter.input).should.equal("string");
      ("output" in filter).should.equal(true);
      (typeof filter.output).should.equal("string");
      ("multipleInputs" in filter).should.equal(true);
      (typeof filter.multipleInputs).should.equal("boolean");
      ("multipleOutputs" in filter).should.equal(true);
      (typeof filter.multipleOutputs).should.equal("boolean");
      ("timelineSupport" in filter).should.equal(true);
      (typeof filter.timelineSupport).should.equal("boolean");
      ("sliceThreading" in filter).should.equal(true);
      (typeof filter.sliceThreading).should.equal("boolean");
      ("commandSupport" in filter).should.equal(true);
      (typeof filter.commandSupport).should.equal("boolean");

      done();
    });

    it("should enable querying for available pix_fmts", function(done) {
      const fmts = FFmpeg.pix_fmts;

      (typeof fmts).should.equal("object");
      const keys = Object.keys(fmts);
      keys.length.should.not.equal(0);
      const fmt = fmts[keys[0]];
      ("nbComponents" in fmt).should.equal(true);
      (typeof fmt.nbComponents).should.equal("number");
      ("bitsPerPixel" in fmt).should.equal(true);
      (typeof fmt.bitsPerPixel).should.equal("number");
      ("input" in fmt).should.equal(true);
      (typeof fmt.input).should.equal("boolean");
      ("output" in fmt).should.equal(true);
      (typeof fmt.output).should.equal("boolean");
      ("hwAccel" in fmt).should.equal(true);
      (typeof fmt.hwAccel).should.equal("boolean");
      ("paletted" in fmt).should.equal(true);
      (typeof fmt.paletted).should.equal("boolean");
      ("bitstream" in fmt).should.equal(true);
      (typeof fmt.bitstream).should.equal("boolean");
      done();
    });

    it("should enable querying for available sample_fmts", function(done) {
      const fmts = FFmpeg.sample_fmts;
      (typeof fmts).should.equal("object");
      const keys = Object.keys(fmts);
      keys.length.should.not.equal(0);
      const fmt = fmts[keys[0]];
      ("depth" in fmt).should.equal(true);
      (typeof fmt.depth).should.equal("number");
      done();
    });
    it("should enable querying for available layouts", function(done) {
      const layouts = FFmpeg.layouts;
      (typeof layouts).should.equal("object");
      ["channels", "layouts"].forEach(type =>
        Object.keys(layouts).should.containEql(type)
      );
      (typeof layouts.channels).should.equal("object");
      const ch = layouts.channels[Object.keys(layouts.channels)[0]];
      ("description" in ch).should.equal(true);
      (typeof ch.description).should.equal("string");
      const layout = layouts.layouts[Object.keys(layouts.layouts)[0]];
      ("decomposition" in layout).should.equal(true);
      checkStringArray(layout.decomposition);
      done();
    });
    it("should enable querying for available colors", function(done) {
      const colors = FFmpeg.colors;
      (typeof colors).should.equal("object");
      const keys = Object.keys(colors);
      keys.length.should.not.equal(0);
      const color = colors[keys[0]];
      ("rgb" in color).should.equal(true);
      (typeof color.rgb).should.equal("string");
      done();
    });
  });
});
