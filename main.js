
let documentFiles = [];
let mergedPdfBlob;

function toggleTheme() {
    document.body.classList.toggle("light-theme");
}

document.getElementById("drop-area").addEventListener("click", () => document.getElementById("file-input").click());
document.getElementById("drop-area").addEventListener("dragover", (e) => { e.preventDefault(); });
document.getElementById("drop-area").addEventListener("drop", (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
});
document.getElementById("file-input").addEventListener("change", (e) => handleFiles(e.target.files));

function handleFiles(files) {
    for (let file of files) {
        const fileExt = file.name.split('.').pop().toLowerCase();
        const supportedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'docx', 'pptx'];
        
        if (supportedExtensions.includes(fileExt)) {
            documentFiles.push(file);
            updateFileList();
        } else {
            alert(`File type not supported: ${file.name}`);
        }
    }
}

function getFileIcon(fileType) {
    const fileExt = fileType.toLowerCase();
    if (fileExt === 'pdf') return '📄';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) return '🖼️';
    if (fileExt === 'docx') return '📝';
    if (fileExt === 'pptx') return '📊';
    return '📁';
}

function getFileTypeLabel(fileType) {
    const fileExt = fileType.toLowerCase();
    if (fileExt === 'pdf') return 'PDF';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) return 'Image';
    if (fileExt === 'docx') return 'Word';
    if (fileExt === 'pptx') return 'PowerPoint';
    return 'File';
}

function updateFileList() {
    const list = document.getElementById("file-list");
    list.innerHTML = "";
    documentFiles.forEach((file, index) => {
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        let li = document.createElement("li");
        li.className = "file-item";
        li.draggable = true;
        li.dataset.index = index;
        
        let thumbnail = document.createElement("div");
        thumbnail.className = "thumbnail";
        thumbnail.textContent = getFileIcon(fileExt);
        li.appendChild(thumbnail);

        let textContainer = document.createElement("div");
        textContainer.style.flexGrow = "1";
        
        let fileName = document.createElement("div");
        fileName.className = "file-name";
        fileName.textContent = file.name;
        textContainer.appendChild(fileName);
        
        let fileType = document.createElement("span");
        fileType.className = "file-type";
        fileType.textContent = getFileTypeLabel(fileExt);
        textContainer.appendChild(fileType);
        
        li.appendChild(textContainer);

        let removeBtn = document.createElement("button");
        removeBtn.textContent = "✕";
        removeBtn.className = "remove-btn";
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            documentFiles.splice(index, 1);
            updateFileList();
        };
        li.appendChild(removeBtn);
        
        li.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", index));
        li.addEventListener("dragover", (e) => e.preventDefault());
        li.addEventListener("drop", (e) => {
            e.preventDefault();
            let fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
            let toIndex = parseInt(li.dataset.index);
            if (fromIndex !== toIndex) {
                let temp = documentFiles[fromIndex];
                documentFiles.splice(fromIndex, 1);
                documentFiles.splice(toIndex, 0, temp);
                updateFileList();
            }
        });
        
        list.appendChild(li);
    });
}

async function convertImageToPdf(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                const img = new Image();
                img.onload = async function() {
                    try {
                        const pdfDoc = await PDFLib.PDFDocument.create();
                        let imgData;
                        
                        // Handle different image types
                        const fileType = file.type.split('/')[1];
                        if (fileType === 'jpeg' || fileType === 'jpg') {
                            imgData = await pdfDoc.embedJpg(event.target.result);
                        } else if (fileType === 'png') {
                            imgData = await pdfDoc.embedPng(event.target.result);
                        } else {
                            // For other formats, convert to PNG
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            const pngData = canvas.toDataURL('image/png').split(',')[1];
                            const pngBuffer = Uint8Array.from(atob(pngData), c => c.charCodeAt(0));
                            imgData = await pdfDoc.embedPng(pngBuffer);
                        }
                        
                        // Calculate dimensions to fit the image properly
                        const pageWidth = 612; // Standard letter width in points
                        const pageHeight = 792; // Standard letter height in points
                        
                        const imgWidth = img.width;
                        const imgHeight = img.height;
                        
                        // Calculate the scale to fit the image within the page
                        let scale = 1;
                        if (imgWidth > pageWidth || imgHeight > pageHeight) {
                            const widthScale = pageWidth / imgWidth;
                            const heightScale = pageHeight / imgHeight;
                            scale = Math.min(widthScale, heightScale) * 0.9; // 90% of page to add margins
                        }
                        
                        const scaledWidth = imgWidth * scale;
                        const scaledHeight = imgHeight * scale;
                        
                        // Center the image on the page
                        const x = (pageWidth - scaledWidth) / 2;
                        const y = (pageHeight - scaledHeight) / 2;
                        
                        const page = pdfDoc.addPage([pageWidth, pageHeight]);
                        page.drawImage(imgData, {
                            x: x,
                            y: y,
                            width: scaledWidth,
                            height: scaledHeight
                        });
                        
                        const pdfBytes = await pdfDoc.save();
                        resolve(pdfBytes);
                    } catch (error) {
                        console.error("Error creating PDF from image:", error);
                        reject(error);
                    }
                };
                img.onerror = () => {
                    reject(new Error("Failed to load image"));
                };
                img.src = event.target.result;
            } catch (error) {
                console.error("Error processing image:", error);
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function convertDocumentToPdf(file, fileType) {
    // For Word and PowerPoint, create a placeholder PDF with file info
    // since complete conversion requires server-side processing
    return new Promise(async (resolve, reject) => {
        try {
            const pdfDoc = await PDFLib.PDFDocument.create();
            const page = pdfDoc.addPage([612, 792]);
            
            const typeLabel = fileType === 'docx' ? 'Word Document' : 'PowerPoint Presentation';
            
            page.drawText(`${typeLabel}: ${file.name}`, {
                x: 50,
                y: 700,
                size: 16
            });
            
            // Add file information
            page.drawText(`File Size: ${(file.size / 1024).toFixed(2)} KB`, {
                x: 50,
                y: 650,
                size: 12
            });
            
            page.drawText(`Last Modified: ${new Date(file.lastModified).toLocaleString()}`, {
                x: 50,
                y: 630,
                size: 12
            });
            
            // Add note about conversion limitations
            page.drawText("Note: Full document conversion requires server-side processing.", {
                x: 50,
                y: 580,
                size: 12
            });
            
            page.drawText("This is a placeholder page representing your document.", {
                x: 50,
                y: 560,
                size: 12
            });
            
            const pdfBytes = await pdfDoc.save();
            resolve(pdfBytes);
        } catch (error) {
            reject(error);
        }
    });
}

async function mergeFiles() {
    if (documentFiles.length === 0) {
        alert("No files selected.");
        return;
    }

    // Show progress bar
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-bar");
    const errorLog = document.getElementById("error-log");
    progressContainer.style.display = "block";
    errorLog.style.display = "none";
    errorLog.innerHTML = "";
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
    
    let hasErrors = false;
    
    try {
        const mergedPdf = await PDFLib.PDFDocument.create();
        let processedFiles = 0;
        
        for (let file of documentFiles) {
            try {
                const fileExt = file.name.split('.').pop().toLowerCase();
                let pdfBytes;
                
                // Convert file to PDF based on its type
                if (fileExt === 'pdf') {
                    const fileBytes = await file.arrayBuffer();
                    const pdfDoc = await PDFLib.PDFDocument.load(fileBytes);
                    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                } 
                else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) {
                    pdfBytes = await convertImageToPdf(file);
                    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
                    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                } 
                else if (fileExt === 'docx' || fileExt === 'pptx') {
                    pdfBytes = await convertDocumentToPdf(file, fileExt);
                    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
                    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                }
                
                // Update progress
                processedFiles++;
                const progress = Math.round((processedFiles / documentFiles.length) * 100);
                progressBar.style.width = progress + "%";
                progressBar.textContent = progress + "%";
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                
                // Add to error log instead of alert
                hasErrors = true;
                const errorItem = document.createElement("div");
                errorItem.innerHTML = `<strong>Error processing:</strong> ${file.name}<br>
                                     <span style="font-size: 0.8em; color: #ff9999;">${error.message}</span>`;
                errorLog.appendChild(errorItem);
                
                // Update progress even for failed files
                processedFiles++;
                const progress = Math.round((processedFiles / documentFiles.length) * 100);
                progressBar.style.width = progress + "%";
                progressBar.textContent = progress + "%";
            }
        }
        
        const mergedPdfBytes = await mergedPdf.save();
        mergedPdfBlob = new Blob([mergedPdfBytes], { type: "application/pdf" });
        
        // Hide progress and show download section
        progressContainer.style.display = "none";
        document.getElementById("merged-container").style.display = "block";
        
        // Show error log if there were any errors
        if (hasErrors) {
            errorLog.style.display = "block";
            const summaryMessage = document.createElement("div");
            summaryMessage.innerHTML = "<strong>Note:</strong> Some files could not be processed but were skipped. You can still download the merged PDF with the successfully converted files.";
            summaryMessage.style.marginBottom = "10px";
            errorLog.insertBefore(summaryMessage, errorLog.firstChild);
        }
    } catch (error) {
        console.error("Error merging files:", error);
        alert("Error merging files. Please try again.");
        progressContainer.style.display = "none";
    }
}

function downloadPDF() {
    if (!mergedPdfBlob) return;
    const fileName = document.getElementById("pdf-name").value.trim() || "merged.pdf";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(mergedPdfBlob);
    link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    link.click();
}
