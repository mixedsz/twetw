const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

/**
 * Creates a simple verification image with colored shapes
 * @param {number} correctIndex - Index of the correct option (0-3)
 * @returns {Promise<{buffer: Buffer, path: string}>} - The image buffer and path
 */
async function generateVerificationImage(correctIndex) {
    try {
        // Create a canvas for the verification image
        const canvas = createCanvas(500, 200);
        const ctx = canvas.getContext('2d');

        // Fill the background with a dark color
        ctx.fillStyle = '#1e2124'; // Discord dark theme background
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add a title
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.fillText('Select the Highlighted Shape', canvas.width / 2, 30);

        // Define shapes to draw
        const shapes = [
            // Circle
            (x, y, size, color) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.stroke();
            },
            // Square
            (x, y, size, color) => {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, size, size);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, size, size);
            },
            // Triangle
            (x, y, size, color) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(x + size/2, y);
                ctx.lineTo(x + size, y + size);
                ctx.lineTo(x, y + size);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.stroke();
            },
            // Star
            (x, y, size, color) => {
                const centerX = x + size/2;
                const centerY = y + size/2;
                const spikes = 5;
                const outerRadius = size/2;
                const innerRadius = size/4;

                ctx.fillStyle = color;
                ctx.beginPath();

                for (let i = 0; i < spikes * 2; i++) {
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const angle = Math.PI * i / spikes - Math.PI / 2;
                    const pointX = centerX + radius * Math.cos(angle);
                    const pointY = centerY + radius * Math.sin(angle);

                    if (i === 0) {
                        ctx.moveTo(pointX, pointY);
                    } else {
                        ctx.lineTo(pointX, pointY);
                    }
                }

                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        ];

        // Calculate positions for the shapes
        const shapeSize = 80;
        const padding = 20;
        const startX = (canvas.width - (shapeSize * 4 + padding * 3)) / 2;
        const startY = 60;

        // Draw each shape
        for (let i = 0; i < 4; i++) {
            const x = startX + i * (shapeSize + padding);
            const shapeIndex = i;
            const color = i === correctIndex ? '#5865F2' : '#ffffff'; // Highlight the correct one

            // Draw the shape
            shapes[shapeIndex](x, startY, shapeSize, color);
        }

        // Convert canvas to buffer
        const buffer = canvas.toBuffer('image/png');

        // Create a temporary file path
        const tempDir = path.join(__dirname, '../temp');

        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `verify_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`);

        // Save the image
        fs.writeFileSync(tempFilePath, buffer);

        return {
            buffer,
            path: tempFilePath,
            correctShape: correctIndex // 0: Circle, 1: Square, 2: Triangle, 3: Star
        };
    } catch (error) {
        console.error('Error generating verification image:', error);
        throw error;
    }
}

module.exports = { generateVerificationImage };
