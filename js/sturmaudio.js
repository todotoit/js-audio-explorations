/**
	STURMAUDIO LIBRARY 
**/

var SturmAudio = (function() {

	var audioContext;
	
	//Audio File
	var fileBuffer;
	var startedAt = 0;
	var pausedAt = 0;
	var playing = false;
	var rawBuffer;
	var playing = false;

	//Line-in (mic)
	var micInput = null;
	var muted = false;

	//Audio analysis
	var audioAnaliser;
	var smoothing = 0.8;
	var fft_size = 2048;
	var freqDataArray;
	var timeDataArray;

	function initAudio() {
		//Init Web Audio Device
		audioContext = new AudioContext();

		//Init navigator getUserMedia to get access to line-in (microphone)
		if (!navigator.getUserMedia) 
			navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

		navigator.getUserMedia(
	    	{
		        "audio": {
		            "mandatory": {
		                "googEchoCancellation": "false",
		                "googAutoGainControl": "false",
		                "googNoiseSuppression": "false",
		                "googHighpassFilter": "false"
		            },
		            "optional": []
		        },
	    	}, getStream, function(e) {
	        alert('Error getting audio from mic');
	        console.log(e);
	    	});

		//Init audio analyser
		audioAnaliser = audioContext.createAnalyser();
		audioAnaliser.connect(audioContext.destination);

		audioAnaliser.smoothingTimeConstant = smoothing;
		audioAnaliser.fftSize = fft_size;

		freqDataArray = new Uint8Array(audioAnaliser.frequencyBinCount);
		timeDataArray = new Uint8Array(audioAnaliser.frequencyBinCount);
	}



	//Asynchronously loading audio file
	var loadFile = function(url) {
		if (!fileBuffer) {
			fileBuffer = audioContext.createBufferSource();
			fileBuffer.connect(audioAnaliser);
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

	//Play the loaded file
	var playFile = function() {
		if (!playing) {
			var offset = pausedAt;
			
			if (!fileBuffer) {
				fileBuffer = audioContext.createBufferSource();
				fileBuffer.connect(audioAnaliser);
				fileBuffer.buffer = rawBuffer;
			}

			fileBuffer.start(0, offset);
			startedAt = audioContext.currentTime - offset;
			pausedAt = 0;
			playing = true;
		}
	}

	//Pause the loaded file
	var pauseFile = function() {
		if (playing) {
			var elapsed = audioContext.currentTime - startedAt;
			stopFile();
			pausedAt = elapsed;
		}
	}

	//Stop the loaded file
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

	//Use this when audio file loading is done outside the library (without calling loadFile())
	var setRawBuffer = function(buffer) {
		rawBuffer = buffer;
	}

	//Open the line-input stream
	var getStream = function(stream) {
		micInput = audioContext.createMediaStreamSource(stream);
		micInput.connect(audioAnaliser);
	}

	//Mute/unmute microphone
	var mute_unmute = function() {
		muted = !muted;

		if (muted) {
			micInput.disconnect();
		}
		else {
			micInput.connect(audioAnaliser);
		}
	}

	var computeFrequencyData = function() {
		audioAnaliser.getByteFrequencyData(freqDataArray);
	}

	var computeTimeData = function() {
		audioAnaliser.getByteTimeDomainData(timeDataArray);
	}

	initAudio();

	return {
		loadFile: loadFile,
		playFile: playFile,
		pauseFile: pauseFile,
		stopFile: stopFile,
		mute_unmute: mute_unmute,
		setRawBuffer: setRawBuffer,
		computeFrequencyData: computeFrequencyData,
		computeTimeData: computeTimeData,
		audioContext: audioContext,
		micInput: micInput,
		audioAnaliser: audioAnaliser,
		freqDataArray: freqDataArray,
		timeDataArray: timeDataArray
	}
})();