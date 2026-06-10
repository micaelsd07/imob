const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');

const frameCount = 80;
const images = [];
let loadedImages = 0;
const currentFrame = { index: 0 };
let targetFrameIndex = 0;

// UI Elements
const heroText = document.getElementById('hero-text');
const scrollIndicator = document.getElementById('scroll-indicator');
const finalSection = document.getElementById('final-section');

// Function to get image path
const getImagePath = (index) => {
    const num = index.toString().padStart(3, '0');
    return `imagens/Luxury_apartment_interior_to_ext…_202606101918_${num}.jpg`;
};

// Resize Canvas to fit screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render(Math.round(currentFrame.index));
}

// Draw image with "object-fit: cover" logic
function drawImageCover(img) {
    if (!img) return;
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.width / img.height;
    
    let drawWidth = canvas.width;
    let drawHeight = canvas.height;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasRatio > imgRatio) {
        // Canvas is wider than image (relative)
        drawHeight = canvas.width / imgRatio;
        offsetY = (canvas.height - drawHeight) / 2;
    } else {
        // Canvas is taller than image (relative)
        drawWidth = canvas.height * imgRatio;
        offsetX = (canvas.width - drawWidth) / 2;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

// Render specific frame
function render(index) {
    if (images[index] && images[index].complete) {
        drawImageCover(images[index]);
    }
}

// Preload all images
for (let i = 0; i < frameCount; i++) {
    const img = new Image();
    img.src = getImagePath(i);
    img.onload = () => {
        loadedImages++;
        // Render first frame immediately once loaded
        if (i === 0) {
            resizeCanvas();
        }
    };
    images.push(img);
}

window.addEventListener('resize', resizeCanvas);

// Scroll Listener
window.addEventListener('scroll', () => {
    const scrollTop = document.documentElement.scrollTop;
    const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;
    const scrollFraction = scrollTop / maxScrollTop;
    
    // Determine target frame index based on scroll
    targetFrameIndex = Math.min(frameCount - 1, Math.floor(scrollFraction * frameCount));

    // Handle UI visibility
    // Fade out hero text early
    if (scrollFraction < 0.15) {
        heroText.style.opacity = 1;
        heroText.style.transform = 'translateY(0)';
        scrollIndicator.style.opacity = 1;
    } else {
        const fade = Math.max(0, 1 - (scrollFraction - 0.15) * 5); // Fades to 0 by 0.35
        heroText.style.opacity = fade;
        heroText.style.transform = `translateY(${ (1-fade) * -30 }px)`;
        scrollIndicator.style.opacity = fade;
    }

    // Fade in final section late
    if (scrollFraction > 0.85) {
        finalSection.classList.add('visible');
    } else {
        finalSection.classList.remove('visible');
    }
});

// Animation Loop for smooth scrubbing
function loop() {
    // Linear Interpolation for smooth frame transition
    const ease = 0.08;
    currentFrame.index += (targetFrameIndex - currentFrame.index) * ease;
    
    // Only render if there's a meaningful change
    render(Math.round(currentFrame.index));
    
    requestAnimationFrame(loop);
}

// Start loop
loop();
