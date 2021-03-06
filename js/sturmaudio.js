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
	var audioAnalyser;
	var smoothing = 0.8;
	var fft_size = 2048;
	var freqDataArray;
	var timeDataArray;

	var filters = new Array();
	var audioNodes = new Array();

	function initAudio() {
		//Init Web Audio Device
		audioContext = new AudioContext();

		//Init navigator getUserMedia to get access to line-in (microphone)
		if (!navigator.getUserMedia) 
			navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;


		//Init audio analyser
		audioAnalyser = audioContext.createAnalyser();
		audioAnalyser.connect(audioContext.destination);

		audioAnalyser.smoothingTimeConstant = smoothing;
		audioAnalyser.fftSize = fft_size;

		freqDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
		timeDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
	}


	//###########################################################################
	//# AUDIO FILE LOADING AND PLAYBACK
	//###########################################################################
	//Asynchronously loading audio file
	var loadFile = function(url) {
		if (!fileBuffer) {
			fileBuffer = audioContext.createBufferSource();
			connectToFilter(fileBuffer);
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
				connectToFilter(fileBuffer);
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

	//###########################################################################
	//# LINE IN INPUT
	//###########################################################################

	var initLineInInput = function() {
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
	}

	//Open the line-input stream
	var getStream = function(stream) {
		micInput = audioContext.createMediaStreamSource(stream);
		connectToFilter(micInput);
		//micInput.connect(audioAnalyser);
	}

	//Mute/unmute microphone
	var mute_unmute = function() {
		muted = !muted;

		if (muted) {
			micInput.disconnect();
		}
		else {
			connectToFilter(micInput);
		}
	}

	var computeFrequencyData = function() {
		audioAnalyser.getByteFrequencyData(freqDataArray);
	}

	var computeTimeData = function() {
		audioAnalyser.getByteTimeDomainData(timeDataArray);
	}

	//Convert frequency value to bar index
	var convertFreqToBar = function(freq) {
		//Max Frequency = SampleRate / 2
		var maxFreq = audioAnalyser.context.sampleRate / 2;
		
		return Math.floor(freq*audioAnalyser.fftSize/maxFreq);
	}

	//Convert bar to frequency
	var convertBarToFreq = function(bar) {
		//Max Frequency = SampleRate / 2
		var maxFreq = audioAnalyser.context.sampleRate / 2;
		var barSize = maxFreq / audioAnalyser.fftSize;

		return barSize * bar;
	}

	//Compute average amplitude in bar range
	var getAverageAmplitudeInRange = function(min, max) {
		var tot = 0;
		for (var i=min; i<max; i++) {
			tot += freqDataArray[i];
		}

		return tot/(max - min);;
	}

	//Compute average amplitude without limits
	var getAverageAmplitude = function() {
		var tot = 0;
		for (var i=0; i<freqDataArray.length; i++) {
			tot += freqDataArray[i];
		}

		return tot/freqDataArray.length;
	}

	//###########################################################################
	//# FILTERS	
	//###########################################################################
	
	//Create a new filter and store in an array of filters so we can chain them later
	var createFilter = function(type, frequency, gain, quality) {
		var filter = audioContext.createBiquadFilter();
		filter.type = type;
		filter.frequency.value = frequency;
		filter.Q.value = quality;
		filter.gain.value = gain;
		filters.push(filter);

		refreshFilterChain();
	}

	//If there are filters connect device to filters otherwise connect device to audio analyser directly
	var connectToFilter = function(device) {
		if (filters.length > 0) {
			device.connect(filters[0]);
		}
		else {
			device.connect(audioAnalyser);
		}
	}

	//Refresh the filters chain everytime we add a new filter 
	var refreshFilterChain = function() {
		if (filters.length > 1) {
			for (var i=0; i<filters.length; i++) {
				filters[i].disconnect();
			}

			for (var i=0; i<filters.length-1; i++) {
				filters[i].connect(filters[i+1]);
			}

			filters[filters.length-1].connect(audioAnalyser);
		}
		else {
			filters[0].connect(audioAnalyser);
		}
	}

	var updateFilterFrequency = function(index, frequency) {
		if (filters.length > 0) {
			filters[index].frequency.value = frequency;
		}
	}

	var playFast = function(url) {
		var request = new XMLHttpRequest();
		var audioBuffer = audioContext.createBufferSource();
		audioBuffer.connect(audioContext.destination);
		request.open('GET', url, true);
		request.responseType = 'arraybuffer';


		request.onload = function() {
			audioContext.decodeAudioData(request.response, function(buffer) {
				rawBuffer = buffer;
				audioBuffer.buffer = buffer;
				audioBuffer.start();
			});
		}

		request.send();
	}

	//###########################################################################
	//# NODES	
	//###########################################################################
	var addAudioNode = function(audioNode) {
		audioNodes.push(audioNode);

		if (audioNodes.length > 0) {

		}
	}

	initAudio();

	return {
		initLineInInput: initLineInInput,
		createFilter: createFilter,
		loadFile: loadFile,
		playFile: playFile,
		pauseFile: pauseFile,
		stopFile: stopFile,
		mute_unmute: mute_unmute,
		setRawBuffer: setRawBuffer,
		computeFrequencyData: computeFrequencyData,
		computeTimeData: computeTimeData,
		updateFilterFrequency: updateFilterFrequency,
		audioContext: audioContext,
		micInput: micInput,
		audioAnalyser: audioAnalyser,
		freqDataArray: freqDataArray,
		timeDataArray: timeDataArray,
		getAverageAmplitudeInRange: getAverageAmplitudeInRange,
		getAverageAmplitude: getAverageAmplitude,
		convertFreqToBar: convertFreqToBar,
		convertBarToFreq: convertBarToFreq,
		playFast: playFast
	}
})();