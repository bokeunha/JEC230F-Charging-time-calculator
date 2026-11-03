const socPts = [5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95];
const tempPts = [-20,-10,0,10,20,25,30,45];
const table = {
  "-20":[1.7,1.8,1.8,1.9,1.8,1.9,1.9,1.9,1.9,0,0,0,0,0,0,0,0,0,0],
  "-10":[13,13,14,14,14,10,7,4,2.1,0,0,0,0,0,0,0,0,0,0],
  "0":[21,21,22,22,22,20,19,19,18,17,13,10,10,4,2,0,0,0,0],
  "10":[48,49,49,50,50,51,51,52,46,41,38,35,31,27,16,6,3,2,0],
  "20":[81,83,83,72,65,63,62,61,56,48,41,37,35,32,31,25,20,16,0],
  "25":[98,99,100,83,73,69,68,65,61,51,42,38,37,35,36,29,24,19,0],
  "30":[104,107,108,99,92,89,89,87,79,67,58,54,52,49,44,34,28,20,0],
  "45":[76,81,84,86,88,88,88,87,86,80,76,73,73,69,46,29,25,16,0]
};

function interp(x, x1, x2, y1, y2) {
  return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
}

function getPackLimit(soc, temp) {
  let si = Math.max(1, socPts.findIndex(v => v >= soc));
  let ti = Math.max(1, tempPts.findIndex(v => v >= temp));
  let s1 = socPts[si - 1], s2 = socPts[si];
  let t1 = tempPts[ti - 1], t2 = tempPts[ti];
  let p1 = interp(soc, s1, s2, table[t1][si - 1], table[t1][si]);
  let p2 = interp(soc, s1, s2, table[t2][si - 1], table[t2][si]);
  return Math.max(0, interp(temp, t1, t2, p1, p2));
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { packCount, packEnergy, cellTemp, socWindow, socLow, usefulStart, usefulEnd, chargerPower } = JSON.parse(event.body);
  const charger = Math.min(chargerPower, 250);
  const chargerPerPack = charger / packCount;

  let accTime = 0;
  let socArr = [], powerArr = [], timeArr = [];
  let bucketE = 0, bucketP = 0, cnt = 0;
  let rangeStart = usefulStart;
  let rows = [];

  for (let u = usefulStart; u < usefulEnd; u++) {
    const midUseful = u + 0.5;
    const actualSOC = socLow + (midUseful / 100) * socWindow;
    
    const packLimit = getPackLimit(actualSOC, cellTemp);
    const packPower = Math.min(packLimit, chargerPerPack);
    const totalPower = packPower * packCount;
    if (totalPower <= 0) break;

    const e = (packEnergy * packCount * (socWindow / 100)) / 100;
    accTime += e / totalPower;

    socArr.push(u + 1);
    powerArr.push(Number(totalPower.toFixed(1)));
    timeArr.push(Number(accTime.toFixed(2)));

    bucketE += e; 
    bucketP += totalPower; 
    cnt++;

    if ((u + 1) % 5 === 0 || u + 1 === usefulEnd) {
      rows.push({
        range: `${rangeStart} → ${u + 1}`,
        packPower: (bucketP / cnt / packCount).toFixed(1),
        totalPower: (bucketP / cnt).toFixed(1),
        energy: bucketE.toFixed(1),
        time: accTime.toFixed(2)
      });
      rangeStart = u + 1;
      bucketE = 0; 
      bucketP = 0; 
      cnt = 0;
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, socArr, powerArr, timeArr })
  };
};