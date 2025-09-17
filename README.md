# 🦎 Lizard Loop

A playful Progressive Web App (PWA) featuring a 3D-styled lizard button that creates delightful animations and sound effects when clicked.

## Features

- **3D Button Design**: Circular button with depth, shadows, and smooth hover/press animations
- **Audio System**: Dual-audio approach with Web Audio API and HTML Audio fallback
- **Visual Effects**: Animated lizard emojis that bounce around the screen
- **Personal Counter**: Tracks clicks with localStorage persistence
- **PWA Support**: Installable on phones and computers with offline functionality
- **Responsive Design**: Works seamlessly on both mobile and desktop
- **Keyboard Support**: Press spacebar to click the lizard

## Installation

### As a PWA (Recommended)

1. Open the app in a modern web browser (Chrome, Firefox, Safari, Edge)
2. Look for the "Install" button in the address bar or browser menu
3. Click "Install" to add the app to your home screen or desktop
4. The app will work offline after installation

### Local Development

1. Clone or download this repository
2. Open `index.html` in your browser

## File Structure

```
lizard-loop/
├── index.html          # Main application file
├── manifest.json       # PWA manifest for installation
├── sw.js              # Service worker for offline functionality
├── README.md          # This file
└── lizard.wav         # Sound effect file (optional)
```

## Technical Details

### PWA Features
- **Service Worker**: Caches resources for offline functionality
- **Web App Manifest**: Enables installation as a native-like app
- **Responsive Icons**: SVG-based icons that scale perfectly
- **Offline Support**: App works without internet connection

### Audio System
- **Primary**: Web Audio API with preloaded audio buffers
- **Fallback**: HTML Audio API with audio pool to prevent overlap
- **Generated Sound**: Web Audio API fallback for missing audio files

### Visual Effects
- **3D Button**: CSS gradients, shadows, and transforms
- **Bounce Animation**: Keyframe animations with easing functions
- **Click Effects**: Radial gradient pulse on button press
- **Milestone Celebrations**: Extra lizards for every 10th click

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Customization

### Adding Sound Effects
1. Add a `lizard.wav` file to the project directory
2. The app will automatically use it for click sounds
3. If the file is missing, it falls back to generated audio

### Styling
- Modify the CSS variables in `index.html` to change colors
- Adjust button size by changing the `.button-3d` dimensions
- Customize animations by editing the `@keyframes` rules

## Performance

- **Lightweight**: Minimal dependencies, pure HTML/CSS/JavaScript
- **Fast Loading**: Optimized assets and efficient caching
- **Smooth Animations**: Hardware-accelerated CSS transforms
- **Memory Efficient**: Automatic cleanup of animated elements

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the app!

---

**Enjoy clicking your lizard! 🦎**
