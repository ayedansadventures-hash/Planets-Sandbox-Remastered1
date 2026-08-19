class Renderer {
    constructor(gameCanvas, bgCanvas) {
        this.canvas = gameCanvas;
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimize for no alpha backbuffer
        this.bgCanvas = bgCanvas;
        this.bgCtx = this.bgCanvas.getContext('2d', { alpha: false });
        
        this.camera = { x: 0, y: 0, zoom: 10 };
        this.settings = {
            trails: true,
            lighting: true,
            bloom: true
        };
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.generateBackground();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.bgCanvas.width = window.innerWidth * dpr;
        this.bgCanvas.height = window.innerHeight * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.bgCtx.scale(dpr, dpr);
        
        // Need to regenerate bg on resize
        this.generateBackground();
    }

    worldToScreen(wx, wy) {
        return {
            x: (wx - this.camera.x) * this.camera.zoom + (window.innerWidth / 2),
            y: (wy - this.camera.y) * this.camera.zoom + (window.innerHeight / 2)
        };
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - (window.innerWidth / 2)) / this.camera.zoom + this.camera.x,
            y: (sy - (window.innerHeight / 2)) / this.camera.zoom + this.camera.y
        };
    }

    generateBackground() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        this.bgCtx.fillStyle = '#030509';
        this.bgCtx.fillRect(0, 0, w, h);
        
        // Nebula effect
        const grad = this.bgCtx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w);
        grad.addColorStop(0, 'rgba(15, 25, 45, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.bgCtx.fillStyle = grad;
        this.bgCtx.fillRect(0, 0, w, h);

        // Stars
        this.bgCtx.fillStyle = '#ffffff';
        for(let i = 0; i < 1500; i++) {
            const sx = Math.random() * w;
            const sy = Math.random() * h;
            const sr = Math.random() * 1.5;
            
            const r = Math.random();
            if (r > 0.9) this.bgCtx.fillStyle = '#b8d4ff';
            else if (r > 0.8) this.bgCtx.fillStyle = '#ffdfb8';
            else this.bgCtx.fillStyle = '#ffffff';

            this.bgCtx.globalAlpha = Math.random() * 0.8 + 0.2;
            this.bgCtx.beginPath();
            this.bgCtx.arc(sx, sy, sr, 0, Math.PI * 2);
            this.bgCtx.fill();
        }
        this.bgCtx.globalAlpha = 1.0;
    }

    render(physics, state) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        // Clear frame with slight opacity for motion blur effect if desired, but here we use clearRect
        this.ctx.clearRect(0, 0, w, h);

        // Find primary star for lighting
        let sun = null;
        if (this.settings.lighting) {
            let maxMass = 0;
            for (const b of physics.bodies) {
                if (b.type === 'star' && b.mass > maxMass) {
                    maxMass = b.mass;
                    sun = b;
                }
            }
        }

        // Draw Trails
        if (this.settings.trails) {
            this.ctx.lineWidth = 1;
            for (const b of physics.bodies) {
                if (b.trail.length < 2) continue;
                
                this.ctx.beginPath();
                const start = this.worldToScreen(b.trail[0].x, b.trail[0].y);
                this.ctx.moveTo(start.x, start.y);
                
                for (let i = 1; i < b.trail.length; i++) {
                    const pt = this.worldToScreen(b.trail[i].x, b.trail[i].y);
                    this.ctx.lineTo(pt.x, pt.y);
                }
                const cur = this.worldToScreen(b.x, b.y);
                this.ctx.lineTo(cur.x, cur.y);
                
                // Gradient trail fading
                this.ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
                this.ctx.stroke();
            }
        }

        // Draw Bodies
        for (const b of physics.bodies) {
            const pos = this.worldToScreen(b.x, b.y);
            const r = Math.max(b.radius * this.camera.zoom, 1.5);
            
            // Culling
            if (pos.x + r < 0 || pos.x - r > w || pos.y + r < 0 || pos.y - r > h) continue;

            if (this.settings.bloom && b.type === 'star') {
                this.ctx.shadowBlur = r * 3;
                this.ctx.shadowColor = b.color;
            } else {
                this.ctx.shadowBlur = 0;
            }

            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            
            if (b.type === 'star') {
                const grad = this.ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.3, b.color);
                grad.addColorStop(1, '#ff8800');
                this.ctx.fillStyle = grad;
            } else {
                this.ctx.fillStyle = b.color;
            }
            this.ctx.fill();

            // Atmospheric Scattering & Shadow (Lighting)
            if (b.type !== 'star' && this.settings.lighting && sun && r > 2) {
                const sunPos = this.worldToScreen(sun.x, sun.y);
                const dx = sunPos.x - pos.x;
                const dy = sunPos.y - pos.y;
                const angleToSun = Math.atan2(dy, dx);
                
                // Shadow
                this.ctx.save();
                this.ctx.translate(pos.x, pos.y);
                this.ctx.rotate(angleToSun);
                const shadowGrad = this.ctx.createLinearGradient(0, 0, -r, 0);
                shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
                shadowGrad.addColorStop(0.5, 'rgba(0,0,0,0.7)');
                shadowGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
                this.ctx.fillStyle = shadowGrad;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, r+0.5, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();

                // Atmosphere glow
                if (b.type === 'earth' || b.type === 'gas') {
                    this.ctx.beginPath();
                    this.ctx.arc(pos.x, pos.y, r * 1.2, 0, Math.PI * 2);
                    const atmosGrad = this.ctx.createRadialGradient(pos.x, pos.y, r, pos.x, pos.y, r * 1.2);
                    atmosGrad.addColorStop(0, b.type === 'earth' ? 'rgba(100, 150, 255, 0.4)' : 'rgba(200, 180, 150, 0.4)');
                    atmosGrad.addColorStop(1, 'rgba(0,0,0,0)');
                    this.ctx.fillStyle = atmosGrad;
                    this.ctx.fill();
                }
            }
        }
        
        this.ctx.shadowBlur = 0; // Reset

        // Draw Particles
        for (const p of physics.particles) {
            const pos = this.worldToScreen(p.x, p.y);
            const pr = p.radius * (p.life / p.maxLife) * (this.camera.zoom * 0.1 + 1);
            if (pos.x < 0 || pos.x > w || pos.y < 0 || pos.y > h) continue;
            
            this.ctx.globalAlpha = p.life / p.maxLife;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, Math.max(pr, 0.5), 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;

        // Draw creation drag line
        if (state.isDragging && state.dragStart) {
            this.ctx.strokeStyle = '#5c9eff';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(state.dragStart.x, state.dragStart.y);
            this.ctx.lineTo(state.pointer.x, state.pointer.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }
}
