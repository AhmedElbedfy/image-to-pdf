const { ipcRenderer, shell } = require('electron');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

// DOM Elements
const imageInput = document.getElementById('image-input');
const imageList = document.getElementById('image-list');
const generatePdfButton = document.getElementById('generate-pdf');
const pageSizeSelect = document.getElementById('page-size');
const compressImagesCheckbox = document.getElementById('compress-images');
const spinner = document.getElementById('spinner');
const footerLink = document.getElementById('footer-link');
const clearListButton = document.getElementById('clear-list');


// State
let images = [];

// Constants
const PAGE_SIZES = {
    A4: { width: 595.28, height: 841.89 }, // A4 size in points
    Letter: { width: 612, height: 792 },   // Letter size in points
    Legal: { width: 612, height: 1008 },   // Legal size in points
};

// Helper Functions

/**
 * Updates the UI to display the selected images as thumbnails.
 */
function updateImageList() {
    imageList.innerHTML = '';
    images.forEach((image, index) => {
        const li = document.createElement('li');
        li.dataset.index = index;

        const img = document.createElement('img');
        img.src = image.previewUrl;
        img.className = 'image-thumbnail';

        const name = document.createElement('span');
        name.className = 'image-list-name';
        name.textContent = image.name;

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '🗑️';
        deleteButton.className = 'delete-button';
        deleteButton.addEventListener('click', () => {
            images.splice(index, 1);
            updateImageList();
        });

        li.appendChild(img);
        li.appendChild(name);
        li.appendChild(deleteButton);

        // Drag-and-Drop Functionality
        li.draggable = true;
        li.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', index));
        li.addEventListener('dragover', (e) => e.preventDefault());
        li.addEventListener('drop', (e) => {
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIndex = parseInt(li.dataset.index, 10);
            [images[fromIndex], images[toIndex]] = [images[toIndex], images[fromIndex]];
            updateImageList();
        });

        imageList.appendChild(li);
    });
}

/**
 * Toggles the visibility of the spinner.
 * @param {boolean} visible - Whether the spinner should be visible.
 */
function toggleSpinner(visible) {
    spinner.classList.toggle('visible', visible);
}

/**
 * Compresses an image using a canvas element.
 * @param {File} imageFile - The image file to compress.
 * @returns {Promise<Uint8Array>} - The compressed image as a Uint8Array.
 */
async function compressImage(imageFile) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                (blob) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(new Uint8Array(reader.result));
                    reader.onerror = () => reject(new Error('Error reading compressed image.'));
                    reader.readAsArrayBuffer(blob);
                },
                'image/jpeg', // Use JPEG for compression
                0.7 // Quality (0.7 = 70% compression)
            );
        };
        img.onerror = () => reject(new Error('Failed to load the image for compression.'));
        img.src = URL.createObjectURL(imageFile);
    });
}

/**
 * Generates a PDF from the selected images.
 */
async function generatePdf() {
    if (images.length === 0) {
        alert('Please select images first!');
        return;
    }

    try {
        toggleSpinner(true); // Show the spinner

        const pdfDoc = await PDFDocument.create();
        const pageSize = PAGE_SIZES[pageSizeSelect.value] || PAGE_SIZES.A4;

        for (const image of images) {
            const imgBytes = await readImageFile(image.file);
            let img;

            if (image.type === 'image/jpeg') {
                img = await pdfDoc.embedJpg(imgBytes);
            } else if (image.type === 'image/png') {
                img = await pdfDoc.embedPng(imgBytes);
            } else {
                alert(`Unsupported image format: ${image.name}`);
                continue;
            }

            if (compressImagesCheckbox.checked) {
                const compressedImgBytes = await compressImage(image.file);
                img = await pdfDoc.embedJpg(compressedImgBytes);
            }

            const scale = Math.min(pageSize.width / img.width, pageSize.height / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

            const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
            page.drawImage(img, {
                x: (pageSize.width - scaledWidth) / 2, // Center the image horizontally
                y: (pageSize.height - scaledHeight) / 2, // Center the image vertically
                width: scaledWidth,
                height: scaledHeight,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const savePath = await ipcRenderer.invoke('save-dialog', 'Save PDF');

        if (savePath) {
            fs.writeFileSync(savePath, pdfBytes);
            alert(`PDF generated successfully! Saved at: ${savePath}`);
        } else {
            alert('Save operation was canceled.');
        }
    } catch (error) {
        console.error('Error generating or saving PDF:', error);
        alert('An error occurred while generating the PDF. Check the console for details.');
    } finally {
        toggleSpinner(false); // Hide the spinner
    }
}

/**
 * Reads an image file as a Uint8Array.
 * @param {File} file - The image file to read.
 * @returns {Promise<Uint8Array>} - The image file as a Uint8Array.
 */
function readImageFile(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = () => resolve(new Uint8Array(fileReader.result));
        fileReader.onerror = () => reject(new Error('Error reading image file.'));
        fileReader.readAsArrayBuffer(file);
    });
}

// Event Listeners

imageInput.addEventListener('change', (event) => {
    images = Array.from(event.target.files).map((file) => ({
        name: file.name,
        type: file.type,
        file,
        previewUrl: URL.createObjectURL(file),
    }));
    updateImageList();
});

generatePdfButton.addEventListener('click', generatePdf);

footerLink.addEventListener('click', (event) => {
    event.preventDefault();
    shell.openExternal(footerLink.href);
});

clearListButton.addEventListener('click', () => {
    images = [];
    updateImageList();
    alert('Image list cleared!');
});