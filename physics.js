const G = 0.0001; // Gravitational constant for the simulation

class Particle {
    constructor(x, y, vx, vy, radius, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }
}

class Body {
    constructor(id, type, x, y, vx, vy, mass, radius, color) {
        this.id = id;
        this.type = type; // 'star', 'gas', 'earth', 'rock'
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.mass = mass;
        this.radius = radius;
        this.color = color;
        this.trail = [];
        this.temperature = this.calculateTemp();
    }

    calculateTemp() {
        if (this.type === 'star') return 5778; // Sun surface temp
        return 288; // Default earth temp, will be updated based on distance to stars
    }
}

class PhysicsEngine {
    constructor() {
        this.bodies = [];
        this.particles = [];
        this.nextId = 1;
        this.dt = 1.0;
        
        // Settings
        this.rocheLimitMultiplier = 2.44;
    }

    addBody(type, x, y, vx, vy, mass, radius, color) {
        const b = new Body(this.nextId++, type, x, y, vx, vy, mass, radius, color);
        this.bodies.push(b);
        return b;
    }

    clear() {
        this.bodies = [];
        this.particles = [];
    }

    step(dtScale) {
        const dt = this.dt * dtScale;
        if (dt === 0) return;

        // Semi-implicit Euler Integration
        for (let i = 0; i < this.bodies.length; i++) {
            let ax = 0;
            let ay = 0;
            const b1 = this.bodies[i];

            for (let j = 0; j < this.bodies.length; j++) {
                if (i === j) continue;
                const b2 = this.bodies[j];
                
                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);
                
                // Gravity
                if (dist > 0.1) {
                    const force = G * b2.mass / distSq;
                    ax += force * (dx / dist);
                    ay += force * (dy / dist);
                }

                // Check collision
                if (dist < b1.radius + b2.radius && i < j) {
                    this.handleCollision(i, j);
                    return; // Exit early to avoid index out of bounds, will resume next frame
                }

                // Roche Limit Check (Tidal tearing)
                if (b1.type === 'rock' && b2.mass > b1.mass * 100) {
                    const roche = this.rocheLimitMultiplier * b2.radius * Math.cbrt(b2.mass / b1.mass);
                    if (dist < roche) {
                        this.shatterBody(i, b2);
                        return;
                    }
                }
            }

            b1.vx += ax * dt;
            b1.vy += ay * dt;
        }

        for (const b of this.bodies) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            
            // Trail update
            if (Math.random() < Math.abs(dtScale) * 0.1) {
                b.trail.push({x: b.x, y: b.y});
                if (b.trail.length > 100) b.trail.shift();
            }
            
            // Update Temp
            this.updateTemperature(b);
        }

        this.updateParticles(dt);
    }
    
    updateTemperature(b) {
        if (b.type === 'star') return;
        let totalHeat = 0;
        for (const star of this.bodies) {
            if (star.type === 'star') {
                const dist = Math.hypot(star.x - b.x, star.y - b.y);
                totalHeat += (star.mass * 100000) / (dist * dist);
            }
        }
        // Base temp + heat from stars
        b.temperature = 50 + Math.min(totalHeat, 2000); 
    }

    handleCollision(i, j) {
        const b1 = this.bodies[i];
        const b2 = this.bodies[j];
        
        const relVx = b2.vx - b1.vx;
        const relVy = b2.vy - b1.vy;
        const relSpeed = Math.hypot(relVx, relVy);
        
        // High speed impact shatters the smaller body!
        const shatterSpeed = 5.0; // Threshold
        
        if (relSpeed > shatterSpeed && b1.type !== 'star' && b2.type !== 'star') {
            const smaller = b1.mass < b2.mass ? i : j;
            const larger = smaller === i ? j : i;
            this.shatterBody(smaller, this.bodies[larger]);
        } else {
            // Merge
            const totalMass = b1.mass + b2.mass;
            const newVx = (b1.vx * b1.mass + b2.vx * b2.mass) / totalMass;
            const newVy = (b1.vy * b1.mass + b2.vy * b2.mass) / totalMass;
            
            // Survivor is the heavier one
            const survivor = b1.mass >= b2.mass ? b1 : b2;
            const absorbed = survivor === b1 ? b2 : b1;
            
            survivor.mass = totalMass;
            // Radius scales with cube root of mass
            survivor.radius = Math.cbrt(Math.pow(b1.radius, 3) + Math.pow(b2.radius, 3));
            survivor.vx = newVx;
            survivor.vy = newVy;
            
            // Visual effect
            this.spawnExplosion(absorbed.x, absorbed.y, survivor.color, 30);
            
            // Remove absorbed
            this.bodies.splice(this.bodies.indexOf(absorbed), 1);
        }
    }

    shatterBody(index, attractor) {
        const b = this.bodies[index];
        const numFragments = Math.min(Math.floor(b.mass * 10), 50);
        
        for (let k = 0; k < numFragments; k++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2.0;
            const fradius = b.radius * (0.1 + Math.random() * 0.2);
            const fmass = b.mass / numFragments;
            
            // Add as new small bodies (debris)
            this.addBody('rock', 
                b.x + Math.cos(angle) * b.radius, 
                b.y + Math.sin(angle) * b.radius, 
                b.vx + Math.cos(angle) * speed, 
                b.vy + Math.sin(angle) * speed, 
                fmass, fradius, b.color);
        }
        
        this.spawnExplosion(b.x, b.y, b.color, 50);
        this.bodies.splice(index, 1);
        if (window.showToast) window.showToast(`A body was shattered into debris!`);
    }

    spawnExplosion(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3;
            this.particles.push(new Particle(
                x, y, 
                Math.cos(angle) * speed, Math.sin(angle) * speed, 
                Math.random() * 3 + 1, 
                Math.random() > 0.5 ? color : '#ffffff', 
                Math.random() * 60 + 30
            ));
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= Math.abs(dt) || 1;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
}
