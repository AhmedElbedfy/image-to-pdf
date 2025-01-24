const { ipcRenderer } = require('electron');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const { shell } = require('electron');

const imageInput = document.getElementById('image-input');
const imageList = document.getElementById('image-list');
const generatePdfButton = document.getElementById('generate-pdf');

let images = [];

// Handle Image Selection
imageInput.addEventListener('change', (event) => {
    images = Array.from(event.target.files).map((file) => ({
        name: file.name,
        type: file.type,
        file,
        previewUrl: URL.createObjectURL(file), // Create preview URL
    }));
    updateImageList();
});

// Update UI for Image List with Previews and Drag-and-Drop
function updateImageList() {
    imageList.innerHTML = '';
    images.forEach((image, index) => {
        const li = document.createElement('li');
        li.dataset.index = index;

        const img = document.createElement('img');
        img.src = image.previewUrl;
        img.className = 'image-thumbnail';

        const name = document.createElement('span');
        name.textContent = image.name;

        li.appendChild(img);
        li.appendChild(name);

        // Drag-and-Drop Functionality
        li.draggable = true;

        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
        });

        li.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        li.addEventListener('drop', (e) => {
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIndex = parseInt(li.dataset.index, 10);

            [images[fromIndex], images[toIndex]] = [images[toIndex], images[fromIndex]];
            updateImageList();
        });

        imageList.appendChild(li);
    });
}

const spinner = document.getElementById('spinner');

async function toggleSpinner(visible) {
    if (visible) {
        spinner.classList.add('visible');
    } else {
        spinner.classList.remove('visible');
    }
}

// Generate PDF with Spinner
generatePdfButton.addEventListener('click', async () => {
    if (images.length === 0) {
        alert('Please select images first!');
        return;
    }

    try {
        toggleSpinner(true); // Show the spinner

        const pdfDoc = await PDFDocument.create();

        for (const image of images) {
            const fileReader = new FileReader();

            const imgBytes = await new Promise((resolve, reject) => {
                fileReader.onload = () => resolve(new Uint8Array(fileReader.result));
                fileReader.onerror = () => reject(new Error('Error reading image file.'));
                fileReader.readAsArrayBuffer(image.file);
            });

            let img;
            if (image.type === 'image/jpeg') {
                img = await pdfDoc.embedJpg(imgBytes);
            } else if (image.type === 'image/png') {
                img = await pdfDoc.embedPng(imgBytes);
            } else {
                alert(`Unsupported image format: ${image.name}`);
                continue;
            }

            const page = pdfDoc.addPage([img.width, img.height]);
            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
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
});

// Get the footer link element
const footerLink = document.getElementById('footer-link');

// Add a click event listener to the link
footerLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent the default link behavior
    const url = footerLink.href; // Get the link URL
    shell.openExternal(url); // Open the link in the default browser
});

const clearListButton = document.getElementById('clear-list');

clearListButton.addEventListener('click', () => {
    images = []; // Clear the images array
    updateImageList(); // Update the UI
    alert('Image list cleared!');
});