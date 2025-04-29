function makeItem(jsonObject, imageURL) {
    const containerDiv = document.createElement('div');

    const header = document.createElement('h3');
    header.textContent = jsonObject.mainCategory;
    containerDiv.appendChild(header);

    const subCategory = document.createElement('p');
    subCategory.innerHTML = `<strong>Category:</strong> ${jsonObject.subCategory}`;
    containerDiv.appendChild(subCategory);

    const image = document.createElement('img');
    image.src = imageURL;
    image.alt = "Listing image";
    image.style.maxWidth = '60%';
    image.style.height = 'auto';
    image.style.marginTop = '10px';
    containerDiv.appendChild(image);

    for (const [key, value] of Object.entries(jsonObject)) {
        if (key === "mainCategory" || key === "subCategory") continue;

        const p = document.createElement('p');
        p.innerHTML = `<strong>${key}:</strong> ${value}`;
        containerDiv.appendChild(p);
    }

    return containerDiv;
}
