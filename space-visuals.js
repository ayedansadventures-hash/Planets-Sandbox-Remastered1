var SpaceVisuals = (typeof window !== "undefined" ? (window.SpaceVisuals = {}) : {});
SpaceVisuals = window.SpaceVisuals = (() => {
  const shadows = new Map();
  function shadow(angle) {
    const key = Math.round(angle * 36 / Math.PI);
    if (shadows.has(key)) return shadows.get(key);
    const map = document.createElement('canvas');
    map.width = map.height = 128;
    const surface = map.getContext('2d');
    const pixels = surface.createImageData(128, 128);
    const a = key * Math.PI / 36;
    const lx = Math.cos(a) * .94, ly = Math.sin(a) * .94, lz = .34;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const nx = (x + .5 - 64) / 64, ny = (y + .5 - 64) / 64;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const brightness = .055 + .945 * Math.pow(diffuse, .65);
      const i = (y * 128 + x) * 4;
      pixels.data[i] = 1; pixels.data[i + 1] = 3; pixels.data[i + 2] = 8;
      pixels.data[i + 3] = Math.round((1 - brightness) * 255);
    }
    surface.putImageData(pixels, 0, 0);
    shadows.set(key, map);
    return map;
  }
  function galaxy(width, height) {
    const map = document.createElement('canvas');
    map.width = width; map.height = height;
    const c = map.getContext('2d');
    let seed = 731991;
    const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
    c.translate(width * .5, height * .5);
    c.rotate(-.38);
    const haze = c.createLinearGradient(0, -height * .23, 0, height * .23);
    haze.addColorStop(0, 'rgba(90,115,160,0)');
    haze.addColorStop(.42, 'rgba(110,128,162,.045)');
    haze.addColorStop(.5, 'rgba(180,179,170,.07)');
    haze.addColorStop(.58, 'rgba(110,128,162,.045)');
    haze.addColorStop(1, 'rgba(90,115,160,0)');
    c.fillStyle = haze;
    c.fillRect(-width, -height * .23, width * 2, height * .46);
    for (let i = 0; i < 3400; i++) {
      const x = (random() - .5) * width * 1.7;
      const y = (random() + random() + random() - 1.5) * height * .20;
      const bright = Math.pow(random(), 6);
      const radius = .25 + bright * 1.3;
      const color = random() < .18 ? '255,222,190' : '202,220,255';
      c.fillStyle = `rgba(${color},${.12 + bright * .65})`;
      c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
      if (bright > .7) {
        const glow = c.createRadialGradient(x,y,0,x,y,7);
        glow.addColorStop(0, `rgba(${color},.22)`);
        glow.addColorStop(1, `rgba(${color},0)`);
        c.fillStyle = glow; c.fillRect(x-7,y-7,14,14);
      }
    }
    return map;
  }
  function star(c, radius, color, seed) {
    c.save();
    const corona = c.createRadialGradient(0,0,radius*.75,0,0,radius*4.5);
    corona.addColorStop(0,'rgba(255,240,212,.55)');
    corona.addColorStop(.18,'rgba(255,223,177,.15)');
    corona.addColorStop(1,'rgba(255,223,177,0)');
    c.fillStyle=corona; c.fillRect(-radius*4.5,-radius*4.5,radius*9,radius*9);
    c.beginPath(); c.arc(0,0,radius,0,Math.PI*2); c.clip();
    const disk = c.createRadialGradient(0,0,0,0,0,radius);
    disk.addColorStop(0,'#fffdf2'); disk.addColorStop(.65,'#fff1ce'); disk.addColorStop(1,color);
    c.fillStyle=disk; c.fillRect(-radius,-radius,radius*2,radius*2);
    c.globalAlpha=.14;
    for(let i=0;i<180;i++) {
      const a=i*2.399963+seed, r=Math.sqrt((i+.5)/180)*radius;
      c.fillStyle=i%3 ? '#c99c52' : '#ffffff';
      c.beginPath(); c.arc(Math.cos(a)*r,Math.sin(a)*r,Math.max(.4,radius*.024),0,Math.PI*2); c.fill();
    }
    c.restore();
  }
  return { shadow, galaxy, star };
})();
