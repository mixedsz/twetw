const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { request } = require('undici');
const path = require('path');
const fs = require('fs');

// Function to generate a welcome image
async function generateWelcomeImage(member, guildName) {
    try {
        // Canvas dimensions
        const width = 1000;
        const height = 400;

        // Create canvas
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Load background image (use a default if guild doesn't have one)
        let backgroundImage;
        try {
            // Try to get guild banner or icon
            const guildBannerURL = member.guild.bannerURL({ extension: 'png', size: 1024 });
            const guildIconURL = member.guild.iconURL({ extension: 'png', size: 1024 });

            console.log('Guild banner URL:', guildBannerURL);
            console.log('Guild icon URL:', guildIconURL);

            if (guildBannerURL) {
                backgroundImage = await loadImage(guildBannerURL);
            } else if (guildIconURL) {
                backgroundImage = await loadImage(guildIconURL);
            } else {
                // Default background if no guild image is available
                backgroundImage = await loadImage(path.join(__dirname, '../assets/default_background.png'));
            }
        } catch (error) {
            console.error('Error loading guild background:', error);
            // Fallback to a default background
            backgroundImage = await loadImage(path.join(__dirname, '../assets/default_background.png'));
        }

        // Draw background with a dark overlay
        ctx.drawImage(backgroundImage, 0, 0, width, height);

        // Add a semi-transparent overlay to make text more readable
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, height);

        // Removed the red bar on the left side

        // Load user avatar
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
        const avatar = await loadImage(avatarURL);

        // Draw avatar in a circle
        const avatarSize = 150;
        const avatarX = width / 2 - avatarSize / 2;
        const avatarY = height / 2 - avatarSize / 2 - 20; // Slightly above center

        // Save context before clipping
        ctx.save();

        // Create circular clipping path
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        // Draw avatar
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);

        // Reset clipping path
        ctx.restore();

        // Add white circle border around avatar
        ctx.beginPath();
        ctx.arc(width / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2, true);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 5;
        ctx.stroke();

        // Add server name at the top
        ctx.font = 'bold 50px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(guildName, width / 2, 80);

        // Add welcome text
        ctx.font = '30px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(`@${member.user.username} just joined the server`, width / 2, avatarY + avatarSize + 50);

        // Add member count
        ctx.font = '25px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(`Member #${member.guild.memberCount}`, width / 2, avatarY + avatarSize + 90);

        // Convert canvas to buffer
        const buffer = canvas.toBuffer('image/png');

        // Create a temporary file path
        const tempFilePath = path.join(__dirname, `../temp/welcome_${member.id}_${Date.now()}.png`);

        // Ensure temp directory exists
        if (!fs.existsSync(path.join(__dirname, '../temp'))) {
            fs.mkdirSync(path.join(__dirname, '../temp'), { recursive: true });
        }

        // Save the image
        fs.writeFileSync(tempFilePath, buffer);

        return {
            path: tempFilePath,
            buffer: buffer
        };
    } catch (error) {
        console.error('Error generating welcome image:', error);
        throw error;
    }
}

module.exports = { generateWelcomeImage };
