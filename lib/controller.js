var doesProtocolMatch, helper, protocols, sortIndices;

helper = require('./helper');

protocols = ['weather1', 'weather2', 'switch1', 'switch2', 'switch3', 'switch4'];

protocols = protocols.map((function(_this) {
  return function(p) {
    return require("./protocols/" + p)(helper);
  };
})(this));

doesProtocolMatch = function(pulseLengths, pulses, protocol) {
  var i, maxDelta;
  if (pulses.length !== protocol.pulseCount) {
    return false;
  }
  if (pulseLengths.length !== protocol.pulseLengths.length) {
    return false;
  }
  i = 0;
  while (i < pulseLengths.length) {
    maxDelta = pulseLengths[i] * 0.25;
    if (Math.abs(pulseLengths[i] - protocol.pulseLengths[i]) > maxDelta) {
      return false;
    }
    i++;
  }
  return true;
};

sortIndices = function(array) {
  var e, i, indices, j, tuple, tuples, _i, _j, _len, _len1;
  tuples = new Array(array.length);
  for (i = _i = 0, _len = array.length; _i < _len; i = ++_i) {
    e = array[i];
    tuples[i] = [e, i];
  }
  tuples.sort(function(left, right) {
    if (left[0] < right[0]) {
      return -1;
    } else {
      return 1;
    }
  });
  indices = new Array(array.length);
  for (j = _j = 0, _len1 = tuples.length; _j < _len1; j = ++_j) {
    tuple = tuples[j];
    indices[tuple[1]] = j;
  }
  return indices;
};

module.exports = {
  debug: false,
  compressTimings: function(timings) {
    var bucket, buckets, counts, hasMatch, i, j, pulses, sums, timing, _i, _j, _k, _len, _len1, _len2;
    pulses = '';
    buckets = [];
    sums = [];
    counts = [];
    for (i = _i = 0, _len = timings.length; _i < _len; i = ++_i) {
      timing = timings[i];
      hasMatch = false;
      for (j = _j = 0, _len1 = buckets.length; _j < _len1; j = ++_j) {
        bucket = buckets[j];
        if (Math.abs(bucket - timing) < bucket * 0.5) {
          pulses += j;
          sums[j] += timing;
          counts[j]++;
          hasMatch = true;
        }
      }
      if (!hasMatch) {
        pulses += buckets.length;
        buckets.push(timing);
        sums.push(timing);
        counts.push(1);
      }
    }
    for (j = _k = 0, _len2 = buckets.length; _k < _len2; j = ++_k) {
      bucket = buckets[j];
      buckets[j] = Math.round(sums[j] / counts[j]);
    }
    return {
      buckets: buckets,
      pulses: pulses
    };
  },
  prepareCompressedPulses: function(input) {
    var parts, pulseLengths, pulses, sortedIndices;
    parts = input.split(' ');
    pulseLengths = parts.slice(0, 8);
    pulses = parts[8];
    pulseLengths = pulseLengths.filter(function(puls) {
      return puls !== '0';
    }).map(function(puls) {
      return parseInt(puls, 10);
    });
    sortedIndices = sortIndices(pulseLengths);
    pulseLengths.sort(function(l, r) {
      return l - r;
    });
    pulses = helper.mapByArray(pulses, sortedIndices);
    return {
      pulseLengths: pulseLengths,
      pulses: pulses
    };
  },
  decodePulses: function(pulseLengths, pulses) {
    var err, p, results, values, _i, _len;
    results = [];
    for (_i = 0, _len = protocols.length; _i < _len; _i++) {
      p = protocols[_i];
      if (doesProtocolMatch(pulseLengths, pulses, p)) {
        try {
          values = p.decodePulses(pulses);
          results.push({
            protocol: p.name,
            values: values
          });
        } catch (_error) {
          err = _error;
          if (this.debug) {
            console.log("Error trying to parse message with protocol " + p.name + ": " + err.stack);
          }
          if (!(err instanceof helper.ParsingError)) {
            throw err;
          }
        }
      }
    }
    return results;
  },
  encodeMessage: function(protocolName, message) {
    var p, protocol, _i, _len;
    protocol = null;
    for (_i = 0, _len = protocols.length; _i < _len; _i++) {
      p = protocols[_i];
      if (p.name === protocolName) {
        protocol = p;
        break;
      }
    }
    if (protocol == null) {
      throw new Error("Could not find a protocol named " + protocolName);
    }
    if (protocol.encodeMessage == null) {
      throw new Error("The protocol has no send report.");
    }
    return {
      pulseLengths: protocol.pulseLengths,
      pulses: protocol.encodeMessage(message)
    };
  }
};