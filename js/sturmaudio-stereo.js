/**
	STURMAUDIO LIBRARY 
**/

var SturmAudio = (function() {
    
    var audioContext;
    var stereoSplitter;
    var audioMerger;
    var speakers;
    var audioAnalysers = new Array();

    var lineIn = null;
    var muted = false;

    var LEFT = 0;
    var RIGHT = 1;

    //Audio File
	var fileBuffer;
	var startedAt = 0;
	var pausedAt = 0;
	var playing = false;
	var rawBuffer;
	var playing = false;

    var audioAnalysers = new Array();
    var freqDataArrays = new Array();

    function initAudio() {
        audioContext = new AudioContext();
        stereoSplitter = audioContext.createChannelSplitter(2);
        audioMerger = audioContext.createChannelMerger(2);
        speakers = audioContext.destination;

        //LEFT Channel AudioAnalyser
        audioAnalysers.push(audioContext.createAnalyser());
        //RIGHT Channel AudioAnalyser
        audioAnalysers.push(audioContext.createAnalyser());
        
        //Connect left channel to left audioAnalyzer
        stereoSplitter.connect(audioAnalysers[LEFT], LEFT);
        //Connect right channel to right audioAnalyzer
        stereoSplitter.connect(audioAnalysers[RIGHT], RIGHT);

        //Connect left channel to audioMerger to get speakers feedback
        stereoSplitter.connect(audioMerger, LEFT, LEFT);
        //Connect right channel to audioMerger to get speakers feedback
        stereoSplitter.connect(audioMerger, RIGHT, RIGHT);
        
        audioMerger.connect(speakers);

        //LEFT channel frequency data array
        freqDataArrays.push(new Uint8Array(audioAnalysers[LEFT].frequencyBinCount));
        //RIGHT channel frequency data array
        freqDataArrays.push(new Uint8Array(audioAnalysers[RIGHT].frequencyBinCount));

        if (!navigator.getUserMedia) 
			navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        

    }

    //###########################################################################
	//# AUDIO FILE LOADING AND PLAYBACK
	//###########################################################################
    var loadFile = function(url) {
        if (!fileBuffer) {
            fileBuffer = audioContext.createBufferSource();
            fileBuffer.connect(stereoSplitter);
        }

        var request = new XMLHttpRequest();
		request.open('GET', url, true);
		request.responseType = 'arraybuffer';

		request.onload = function() {
			audioContext.decodeAudioData(request.response, function(buffer) {
				rawBuffer = buffer;
				fileBuffer.buffer = buffer;
			});
		}

		request.send();
    }

    var playFile = function() {
		if (!playing) {
			var offset = pausedAt;
			
			if (!fileBuffer) {
				fileBuffer = audioContext.createBufferSource();
                fileBuffer.connect(stereoSplitter);
				fileBuffer.buffer = rawBuffer;
			}

			fileBuffer.start(0, offset);
			startedAt = audioContext.currentTime - offset;
			pausedAt = 0;
			playing = true;
		}
	}

    var pauseFile = function() {
		if (playing) {
			var elapsed = audioContext.currentTime - startedAt;
			stopFile();
			pausedAt = elapsed;
		}
	}

    var stopFile = function() {
		if (playing && fileBuffer) {
			fileBuffer.disconnect();
			fileBuffer.stop(0);
			fileBuffer = null;
		}

		pausedAt = 0;
		startedAt = 0;
		playing = false;
	}

    //###########################################################################
	//# LINE IN INPUT
	//###########################################################################
    var initLineInInput = function() {
        if (navigator.getUserMedia) {
            navigator.getUserMedia(
                {
                    audio: {
                        "mandatory": {
                            "echoCancellation": "false"
                        },
                        "optional": []
                    },
                    video: false
                },
                getStream,
                errorMedia
            );
        }
    }

    function getStream(stream) {
        lineIn = audioContext.createMediaStreamSource(stream);
        lineIn.connect(stereoSplitter);
    }

    var mute_unmute = function() {
		muted = !muted;

        if (lineIn) {
            if (muted) {
                lineIn.disconnect();
            }
            else {
                lineIn.connect(stereoSplitter);
            }
        }
	}

    function errorMedia(err) {
        console.log(err);
    }

    //###########################################################################
	//# AUDIO ANALYSIS
	//###########################################################################
    var computeFrequencyData = function(index) {
		audioAnalysers[index].getByteFrequencyData(freqDataArrays[index]);
	}

    var getAverageAmplitude = function(index) {
		var tot = 0;
		for (var i=0; i<freqDataArrays[index].length; i++) {
			tot += freqDataArrays[index][i];
		}

		return tot/freqDataArrays[index].length;
	}

    var getAverageAmplitudeInRange = function(index, min, max) {
		var tot = 0;
		for (var i=min; i<max; i++) {
			tot += freqDataArrays[index][i];
		}

		return tot/(max - min);;
	}

    var convertFreqToBar = function(index, freq) {
		//Max Frequency = SampleRate / 2
		var maxFreq = audioAnalysers[index].context.sampleRate / 2;
		
		return Math.floor(freq*audioAnalysers[index].fftSize/maxFreq);
	}

    var convertBarToFreq = function(index, bar) {
		//Max Frequency = SampleRate / 2
		var maxFreq = audioAnalysers[index].context.sampleRate / 2;
		var barSize = maxFreq / audioAnalysers[index].fftSize;

		return barSize * bar;
	}

    initAudio();

    return {
        initLineInInput: initLineInInput,
        loadFile: loadFile,
        playFile: playFile,
        pauseFile: pauseFile,
        stopFile: stopFile,
        mute_unmute: mute_unmute,
        computeFrequencyData: computeFrequencyData,
        getAverageAmplitude: getAverageAmplitude,
        getAverageAmplitudeInRange: getAverageAmplitudeInRange,
        convertBarToFreq: convertBarToFreq,
        convertFreqToBar: convertFreqToBar
    }
})();