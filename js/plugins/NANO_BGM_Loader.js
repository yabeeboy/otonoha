//=============================================================================
// NANO_BGM_Loader.js
//=============================================================================
/*
 * Copyright (c) 2015 Nano (@tkool_helper)
 *
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 *
 */

/*:
 * @plugindesc BGM play start delay very shorter.
 * only online (Web browser) mode.
 * @author Nano
 *
 * @version 0.1.0
 *
 * @help
 *  nothing.
 *
 */

/*:ja
 * @plugindesc 有効にするだけでウェブ実行でBGMが遅延少なく再生されるようになります。
 * @author なの
 *
 * @help
 *  ありません
 *
 */

if (location.protocol.indexOf('http') == 0) { // online only.

	var PRELOAD_SIZE = 256 * 1024; // 128KB ~ 256KB
	var AUDIO_BUFFER = 16 * 1024; // 8KB ~ 16KB
	var SAMPLE_RATE  = 44100;

	WebAudio._cache = { }; // raw Files. (xhr.response)
	WebAudio._cacheLast = { }; // for LRU

	var WebAudio__createContext = WebAudio._createContext;
	WebAudio._createContext = function() {
		WebAudio__createContext.call(this);
		if (this._context) {
			if(!this._context.createScriptProcessor)
				this._context.createScriptProcessor = this._context.createJavaScriptNode;
		}
	};

	WebAudio.prototype._startPlaying = function(loop, offset) {
		this._removeEndTimer();
		this._removeNodes();
		this._createNodes();
		this._connectNodes();
		this._sourceNode.loop = loop;
		this._sourceNode.start(0, offset);
		this._startTime = WebAudio._context.currentTime - offset / this._pitch;
		if (this.isBGM == false) {
			this._createEndTimer();
		}
	};

	WebAudio.prototype._createNodes = function() {
		var context = WebAudio._context;
		if (this.isBGM) {
			this._sourceNode = new WebAudioScriptProcessor();
		} else {
			this._sourceNode = context.createBufferSource();
		}
		this._sourceNode.buffer = this._buffer;
		this._sourceNode.loopStart = this._loopStart;
		this._sourceNode.loopEnd = this._loopStart + this._loopLength;
		this._sourceNode.playbackRate.value = this._pitch;
		this._gainNode = context.createGain();
		this._gainNode.gain.value = this._volume;
		this._pannerNode = context.createPanner();
		this._pannerNode.panningModel = 'equalpower';
		this._updatePanner();
	};

	WebAudio.prototype._load = function(url) {
		if (WebAudio._context) {
			this.isBGM = (url.indexOf('audio/bgm/') >= 0);
			if (WebAudio._cache[ url ]) {
				this._onXhrLoad({ response: WebAudio._cache[ url ] });
			} else {
				var my = this;
				var xhr = new XMLHttpRequest();
				xhr.open('GET', url);
				xhr.responseType = 'arraybuffer';
				if (this.isBGM) {
					xhr.setRequestHeader('Range', 'bytes=0-' + (PRELOAD_SIZE - 1));
					xhr.onload = function(e) {
						var mediaBuffer = new ArrayBuffer(e.target.response.byteLength);
						var mediaArray = new Uint8Array(mediaBuffer);
						mediaArray.set(new Uint8Array(e.target.response), 0);
						my._onXhrLoad(e.target);
						var fileSize = parseInt(((e.target.getResponseHeader('Content-Range')||'').match(/\s*bytes\s+[0-9]+\-[0-9]+\/([0-9]+)/)||['','-1'])[1]);
						if (fileSize > PRELOAD_SIZE) {
							var loop = new XMLHttpRequest();
							loop.open('GET', url, true);
							loop.setRequestHeader('Range', 'bytes=' + PRELOAD_SIZE + '-');
							loop.responseType = 'arraybuffer';
							loop.onload = function(e) {
								var newBuffer = new ArrayBuffer(mediaBuffer.byteLength + e.target.response.byteLength);
								var typedArray = new Uint8Array(newBuffer);
								typedArray.set(mediaArray, 0);
								typedArray.set(new Uint8Array(e.target.response), mediaBuffer.byteLength);
								mediaBuffer = newBuffer;
								WebAudio._cache[ my.url ] = mediaBuffer;
								WebAudio._cacheLast[ my.url ] = +new Date;
								WebAudio._context.decodeAudioData(mediaBuffer, function(buffer) {
									this._buffer = buffer;
									if (my._sourceNode)
										my._sourceNode.buffer = buffer;
								});
							};
							loop.send();
						}
					}
				} else {
					xhr.onload = function() {
						if (xhr.status < 400) {
							WebAudio._cache[ my.url ] = xhr.response;
							WebAudio._cacheLast[ my.url ] = +new Date;
							this._onXhrLoad(xhr);
						}
					}.bind(this);
				}
				xhr.onerror = function() {
					this._hasError = true;
				}.bind(this);
				xhr.send();
			}
		}
	};


	function WebAudioScriptProcessor() {
		this.isPlay = false;
		this.buffer = null;
		this.offset = 0;
		this.loop = false;
		this.loopStart = 0;
		this.loopEnd = 0;
		this.playbackRate = { value: 0 };
		var my = this;

		if (WebAudio._context) {
			this.sndProc = WebAudio._context.createScriptProcessor(WebAudioScriptProcessor.BufferLength, WebAudioScriptProcessor.Channels, WebAudioScriptProcessor.Channels);
			this.sndFrame = 0;
			this.dummy = WebAudio._context.createBufferSource(); this.dummy.connect(this.sndProc); // for iOS bug.
			this.sndProc.onaudioprocess = function (evt) {
				if (my.buffer && my.isPlay) {
					var isStereo = (my.buffer.numberOfChannels >= WebAudioScriptProcessor.Channels) ? 1 : 0 ;
					var L = evt.outputBuffer.getChannelData(0);
					var R = (evt.target.channelCount >= 2) ? evt.outputBuffer.getChannelData(1) : null ;
					var newSndFrame = my.sndFrame + this.bufferSize;
					if (my.buffer.length < my.loopEnd) {
						if (newSndFrame > my.loopEnd) {
							// buffer under run.
						}
					}
					L.set(my.buffer.getChannelData(0).subarray(my.sndFrame, newSndFrame), 0);
					if (R)
						R.set(my.buffer.getChannelData(isStereo).subarray(my.sndFrame, newSndFrame), 0);
					my.sndFrame = newSndFrame;
					if (my.sndFrame > parseInt(my.loopEnd * SAMPLE_RATE)) {
						var newStart = my.sndFrame - parseInt(my.loopEnd * SAMPLE_RATE);
						var newEnd = parseInt(my.loopStart * SAMPLE_RATE) + newStart;
						var endOffset = this.bufferSize - newStart;
						if (my.loop) {
							L.set(my.buffer.getChannelData(0).subarray((my.loopStart * SAMPLE_RATE), newEnd), endOffset);
							if (R)
								R.set(my.buffer.getChannelData(isStereo).subarray((my.loopStart * SAMPLE_RATE), newEnd), endOffset);
							my.sndFrame = newEnd;
						} else {
							for (var i = endOffset; i < this.buffer; i++) {
								L[i] = R[i] = 0;
							}
							my.sndFrame = newEnd;
							setTimeout(function(){
								my.stop();
							}, (endOffset / SAMPLE_RATE) * 1000);
						}
					}
				}
			}
		}
	}

	WebAudioScriptProcessor.BufferLength = AUDIO_BUFFER;
	WebAudioScriptProcessor.Channels     = 2;

	WebAudioScriptProcessor.prototype = { };

	WebAudioScriptProcessor.prototype.connect = function(node) {
		this.sndProc.connect(node);
	};

	WebAudioScriptProcessor.prototype.start = function(pos, offset) {
		this.isPlay = true;
		this.sndFrame = offset * SAMPLE_RATE;
	};

	WebAudioScriptProcessor.prototype.stop = function(pos) {
		this.dummy.disconnect();
		this.sndProc.disconnect();
		this.isPlay = false;
		this.buffer = null;
	};
}
