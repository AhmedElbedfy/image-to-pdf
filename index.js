const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        // fullscreen: true,
        resizable: true, // Allow resizing
        title: 'Image to PDF Converter', // Custom title
        backgroundColor: '#ffffff', // White background
        frame: true, // Ensure the frame is visible (default is true)


        webPreferences: {
            preload: path.join(__dirname, 'renderer.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile('index.html');
});

ipcMain.handle('save-dialog', async () => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'Save PDF',
        defaultPath: 'output.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    console.log('Selected File Path:', filePath);
    return filePath || null;
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
