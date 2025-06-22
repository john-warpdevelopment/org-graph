const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const clearSearchBtn = document.getElementById("clear-search");

function showSearchResults(results) {
  searchResults.innerHTML = "";

  if (results.length === 0) {
    searchResults.style.display = "none";
    return;
  }

  searchResults.style.display = "block";
  results.forEach((node) => {
    const resultItem = document.createElement("div");
    resultItem.className = "search-result-item";
    
    // Ensure the entire block is clickable
    resultItem.style.cursor = "pointer";

    const typeSpan = document.createElement("div");
    typeSpan.className = "search-result-type";
    typeSpan.textContent = node.type;

    const nameDiv = document.createElement("div");
    nameDiv.textContent = node.label;

    if (node.role) {
      const roleDiv = document.createElement("div");
      roleDiv.style.fontSize = "10px";
      roleDiv.style.color = "#aaa";
      roleDiv.textContent = node.role;
      resultItem.appendChild(nameDiv);
      resultItem.appendChild(roleDiv);
    } else {
      resultItem.appendChild(nameDiv);
    }    resultItem.insertBefore(typeSpan, resultItem.firstChild);

    // Add click handler to the main result item
    const clickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      graph.highlightNode(node);
      searchResults.style.display = "none";
      searchInput.blur();
    };

    resultItem.addEventListener("click", clickHandler);
    
    // Ensure all child elements also trigger the click
    typeSpan.addEventListener("click", clickHandler);
    nameDiv.addEventListener("click", clickHandler);
    if (node.role) {
      const roleDiv = resultItem.querySelector("div:last-child");
      if (roleDiv) {
        roleDiv.addEventListener("click", clickHandler);
      }
    }

    searchResults.appendChild(resultItem);
  });
}

function hideSearchResults() {
  setTimeout(() => {
    searchResults.style.display = "none";
  }, 150);
}

searchInput.addEventListener("input", (e) => {
  const query = e.target.value;
  clearSearchBtn.style.display = query ? "block" : "none";

  const results = graph.searchNodes(query);
  showSearchResults(results);
});

searchInput.addEventListener("focus", () => {
  if (searchInput.value && graph.searchResults.length > 0) {
    searchResults.style.display = "block";
  }
});

searchInput.addEventListener("blur", hideSearchResults);

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  clearSearchBtn.style.display = "none";
  searchResults.style.display = "none";
  graph.clearSearch();
  searchInput.focus();
});

// Handle escape key to clear search
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    searchInput.value = "";
    clearSearchBtn.style.display = "none";
    searchResults.style.display = "none";
    graph.clearSearch();
    searchInput.blur();
  }
});
