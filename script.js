document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('flipForm');
    const lastUpdateDisplay = document.getElementById('last-update');
    const resultsDiv = document.getElementById('results');
    let countdownInterval;
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;
    let isResizing = false;
    const budgetInput = document.querySelector('input[name="budget"]');
    const coinsLabel = document.querySelector('.coins-label');
    let isCooldown = false;
    const submitButton = form.querySelector('button[type="submit"]');

    let blacklistedItems = JSON.parse(localStorage.getItem('blacklistedItems') || '[]');
    const blacklistContainer = document.getElementById('blacklist-container');
    const blacklistedItemsList = document.getElementById('blacklisted-items-list');
    let whitelistTimeout;

    // Filter box elements
    const filterButton = document.getElementById('filter-button');
    const filterBox = document.getElementById('filter-box');
    const closeFilterBox = document.querySelector('.close-filter-box');

    let firstUpdate = true;

    // Function to set the theme
    function setTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            body.classList.add('light-mode');
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
        // Reset transition for all flip items
        resultsDiv.querySelectorAll('.flip-item').forEach(flipDiv => {
            flipDiv.style.transition = 'transform 0.5s ease, background-color 0.3s ease, border-color 0.3s ease';
        });
    }

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.add('no-transition'); // Add no-transition class
        setTheme(savedTheme);
        requestAnimationFrame(() => {
            body.classList.remove('no-transition'); // Remove no-transition class after a frame
        });
    } else {
        setTheme('dark'); // Default to dark mode
    }

    // Toggle theme on button click
    darkModeToggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (body.classList.contains('light-mode')) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    });

    function updateBlacklistDisplay() {
        const blacklistHeader = document.getElementById('blacklist-header');
        const blacklistedCount = blacklistedItems.length;
        blacklistHeader.textContent = `Blacklisted Items (${blacklistedCount})`;
        blacklistContainer.classList.add('show');
        // Clear existing items
        blacklistedItemsList.innerHTML = '';
        // Add blacklisted items to the list
        blacklistedItems.forEach(itemName => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            const formattedName = itemName.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            span.textContent = formattedName;
            const button = document.createElement('button');
            button.textContent = 'Whitelist';
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                // Disable the submit button
                submitButton.disabled = true;
                submitButton.style.backgroundColor = '#95a5a6';
                // Remove the item from the blacklist
                blacklistedItems = blacklistedItems.filter(name => name !== itemName);
                localStorage.setItem('blacklistedItems', JSON.stringify(blacklistedItems));
                // Update display
                li.remove();
                const blacklistedCount = blacklistedItems.length;
                blacklistHeader.textContent = `Blacklisted Items (${blacklistedCount})`;
                // Refresh the flips with debounce
                clearTimeout(whitelistTimeout);
                whitelistTimeout = setTimeout(() => {
                    fetchFlips();
                    // Re-enable the submit button after the debounce
                    setTimeout(() => {
                        submitButton.disabled = false;
                        submitButton.style.backgroundColor = '#3498db';
                    }, 2000);
                }, 2000);
                // Remove the dark styling from the flip item if it exists
                const flipDiv = resultsDiv.querySelector(`.flip-item[data-name="${itemName}"]`);
                if (flipDiv) {
                    flipDiv.style.backgroundColor = '';
                    flipDiv.style.opacity = '';
                    const blacklistButton = flipDiv.querySelector('.blacklist-button');
                    if (blacklistButton) {
                        blacklistButton.style.display = '';
                    }
                }
            });
            li.appendChild(span);
            li.appendChild(button);
            blacklistedItemsList.appendChild(li);
        });
    }

    function updateLastUpdateDisplay(timestamp) {
        clearInterval(countdownInterval);
        const updateTime = new Date((timestamp + 60) * 1000);

        function updateDisplay() {
            const now = new Date();
            let timeLeft = Math.round((updateTime - now) / 1000);

            if (timeLeft > 0) {
                lastUpdateDisplay.textContent = `Next API Update in ${timeLeft} seconds`;
                lastUpdateDisplay.style.color = ''; // Reset color
            } else {
                if (timeLeft < 0) {
                    const timeAgo = Math.abs(timeLeft);
                    lastUpdateDisplay.textContent = `Last API Update ${timeAgo} seconds ago`;
                    lastUpdateDisplay.style.color = 'red';
                } else {
                    lastUpdateDisplay.textContent = `Last API Update 0 seconds ago`;
                    lastUpdateDisplay.style.color = 'red';
                }
                // clearInterval(countdownInterval);
            }
        }

        updateDisplay();
        countdownInterval = setInterval(updateDisplay, 1000);
    }

    if (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (isCooldown) {
                return;
            }
            fetchFlips();
            isCooldown = true;
            submitButton.disabled = true;
            submitButton.style.backgroundColor = '#95a5a6';
            setTimeout(() => {
                isCooldown = false;
                submitButton.disabled = false;
                submitButton.style.backgroundColor = '#3498db';
            }, 2000);
        });
    }

    function fetchFlips() {
        // Close any open flip-item dropdowns
        const closeDropdowns = new Promise(resolve => {
            const expandableContents = resultsDiv.querySelectorAll('.expandable-content');
            let count = expandableContents.length;
            if (count === 0) {
                resolve();
                return;
            }
            expandableContents.forEach(expandableContent => {
                if (expandableContent && expandableContent.style.display === 'block') {
                    expandableContent.style.maxHeight = '0';
                    setTimeout(() => {
                        expandableContent.style.display = 'none';
                        count--;
                        if (count === 0) {
                            resolve();
                        }
                    }, 300);
                } else {
                    count--;
                    if (count === 0) {
                        resolve();
                    }
                }
            });
        });

        closeDropdowns.then(() => {
            const formData = new FormData(form);
            // const competition = formData.get('competition');
            // const volumeSensitivity = formData.get('volumeSensitivity');
            const budget = formData.get('budget');

            let profitWeight = 50;
            let volumeWeight = 50;

            const selectedPreference = formData.get('flipPreference');
            if (selectedPreference) {
                if (selectedPreference === 'balanced_50') {
                    profitWeight = 50;
                    volumeWeight = 50;
                }
                else if (selectedPreference.startsWith('profit_')) {
                    profitWeight = parseInt(selectedPreference.split('_')[1]);
                    volumeWeight = 100 - profitWeight;
                } else if (selectedPreference.startsWith('volume_')) {
                    volumeWeight = parseInt(selectedPreference.split('_')[1]);
                    profitWeight = 100 - volumeWeight;
                }
            }

            console.log("Profit Weight:", profitWeight);
            console.log("Volume Weight:", volumeWeight);
            console.log("Budget:", budget);
            // console.log("Competition:", competition);
            // console.log("Volume Sensitivity:", volumeSensitivity);

            fetch('https://5c99-78-57-126-227.ngrok-free.app/flips', {
                method: 'POST',
                body: new URLSearchParams({
                    profit: profitWeight,
                    volume: volumeWeight,
                    competition: "6",
                    volumeSensitivity: "0.25",
                    budget: budget ? budget : "0",
                    blacklist: JSON.stringify(blacklistedItems)
                })
            })
                .then(response => response.json())
                .then(data => {
                    let newFlips = data && data.flips ? data.flips.slice().reverse() : [];
                    const newFlipNames = newFlips.map(flip => flip.name);

                    const existingFlipElements = {};
                    resultsDiv.querySelectorAll('.flip-item').forEach(flipDiv => {
                        const name = flipDiv.getAttribute('data-name');
                        existingFlipElements[name] = flipDiv;
                    });

                    // First, handle flips that disappear
                    const flipsToRemove = [];
                    Object.keys(existingFlipElements).forEach(name => {
                        if (!newFlipNames.includes(name)) {
                            const flipDiv = existingFlipElements[name];
                            flipsToRemove.push(flipDiv);
                        }
                    });
                    
                    // Capture positions before removing
                    const flipPositionsBefore = {};
                    resultsDiv.querySelectorAll('.flip-item').forEach(flipDiv => {
                        const name = flipDiv.getAttribute('data-name');
                        flipPositionsBefore[name] = flipDiv.getBoundingClientRect();
                    });

                    flipsToRemove.forEach(flipDiv => {
                        flipDiv.classList.add('fade-out');
                        flipDiv.style.pointerEvents = 'none'; // Disable interactions during fade out
                    });

                    // Wait for the removal animation to complete
                    setTimeout(() => {
                        flipsToRemove.forEach(flipDiv => {
                            flipDiv.remove();
                        });

                        // Rearrange flips and add new ones
                        updateFlips(newFlips, existingFlipElements, data.blacklisted);

                        // Allow the DOM to update
                        requestAnimationFrame(() => {
                            // Capture positions after rearranging
                            const flipPositionsAfter = {};
                            resultsDiv.querySelectorAll('.flip-item').forEach(flipDiv => {
                                const name = flipDiv.getAttribute('data-name');
                                flipPositionsAfter[name] = flipDiv.getBoundingClientRect();
                            });

                            // Animate flips moving to new positions
                            Object.keys(flipPositionsAfter).forEach(name => {
                                const flipDiv = existingFlipElements[name];
                                if (flipDiv && !isResizing) {
                                    const before = flipPositionsBefore[name];
                                    const after = flipPositionsAfter[name];
                                    const deltaX = before.left - after.left;
                                    const deltaY = before.top - after.top;
                                    // console.log(deltaX, deltaY);
                                    
                                    if (deltaX || deltaY) {
                                        flipDiv.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                                        flipDiv.style.transition = 'transform 0s';
                                        requestAnimationFrame(() => {
                                            flipDiv.style.transform = '';
                                            flipDiv.style.transition = 'transform 0.5s ease';
                                        });
                                    }
                                } else {                                                
                                    // New flip, already handled in updateFlips
                                }
                            });
                        });
                    }, 200); // Delay matches fade-out duration

                    if (data && data.lastUpdate) {
                        updateLastUpdateDisplay(data.lastUpdate);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    document.getElementById('results').innerHTML = '<p class="error-message">Error fetching flips.</p>';
                });
        });
    }

    function updateFlips(flips, existingFlipElements, blacklisted) {
        const flipsInDOM = {};
        resultsDiv.querySelectorAll('.flip-item').forEach(flipDiv => {
            const name = flipDiv.getAttribute('data-name');
            flipsInDOM[name] = flipDiv;
        });

        const newFlipElements = [];

        flips.forEach((flip, index) => {
            let flipDiv = flipsInDOM[flip.name];
            const formattedName = flip.name.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            let amountToFlipHTML = '';
            if (flip.amountToFlip != null) {
                amountToFlipHTML = `<p><span class="weight">Recommended amount:</span> ${flip.amountToFlip}</p>`;
            }
            let movementArrow = '';
            let isNew = false;
            if (flipDiv) {
                // Flip exists, update its content
                const delta = Object.keys(existingFlipElements).indexOf(flip.name) - index
                
                if (delta > 0) {
                    movementArrow = '<div class="arrow-up"></div>';
                } else if (delta < 0) {
                    movementArrow = '<div class="arrow-down"></div>';
                }
                // Retrieve stored arrow and new status
                const storedArrow = flipDiv.getAttribute('data-arrow') || '';
                const storedIsNew = flipDiv.getAttribute('data-new') === 'true';
                if (storedArrow) {
                    movementArrow = storedArrow;
                }
                flipDiv.innerHTML = `
                    ${movementArrow}<h3>${index + 1}. ${formattedName}</h3>
                    <p><span class="price">Buy Price:</span> ${flip.price.buyOffer}</p>
                    <p><span class="price">Margin:</span> ${flip.price.margin} (${flip.price.marginPercent}%)</p>
                    <p><span class="profit">Current Profit / Minute:</span> ${flip.realProfitPerMin}</p>
                    <p>${flip.competitence.extraOrders}<span class="competitence"> extra orders in </span>${flip.competitence.minsChecked}<span class="competitence"> mintutes </span></p>
                    ${amountToFlipHTML}
                    <div class="expandable-content" style="display: none;">
                        <p><span class="profit">Average Profit / Minute:</span> ${flip.profitPerMin}</p>
                        <p><span class="volume">Items bought / 7 days:</span> ${flip.volume.salesWeek}</p>
                        <p><span class="volume">Current items bought:</span> ${flip.volume.currentSales} (${flip.volume.salesP})</p>
                        <p><span class="volume">Items sold / 7 days:</span> ${flip.volume.buysWeek}</p>
                        <p><span class="volume">Current items sold:</span> ${flip.volume.currentBuys} (${flip.volume.buysP})</p>
                    </div>
                `;
                flipDiv.setAttribute('data-arrow', movementArrow);
                flipDiv.setAttribute('data-new', storedIsNew);
                delete flipsInDOM[flip.name]; // Remove from flipsInDOM so we know which flips are to be removed
            } else {
                // New flip, create flipDiv
                flipDiv = document.createElement('div');
                flipDiv.classList.add('flip-item');
                flipDiv.setAttribute('data-name', flip.name);
                isNew = true;
                flipDiv.innerHTML = `
                    ${firstUpdate ? `` : `<div class="new-icon"></div>`}<h3>${index + 1}. ${formattedName}</h3>
                    <p><span class="price">Buy Price:</span> ${flip.price.buyOffer}</p>
                    <p><span class="price">Margin:</span> ${flip.price.margin} (${flip.price.marginPercent}%)</p>
                    <p><span class="profit">Current Profit / Minute:</span> ${flip.realProfitPerMin}</p>
                    <p>${flip.competitence.extraOrders}<span class="competitence"> extra orders in </span> ${flip.competitence.minsChecked}<span class="competitence"> mintutes </span></p>
                    ${amountToFlipHTML}
                    <div class="expandable-content" style="display: none;">
                        <p><span class="profit">Average Profit / Minute:</span> ${flip.profitPerMin}</p>
                        <p><span class="volume">Items bought / 7 days:</span> ${flip.volume.salesWeek}</p>
                        <p><span class="volume">Current items bought:</span> ${flip.volume.currentSales} (${flip.volume.salesP})</p>
                        <p><span class="volume">Items sold / 7 days:</span> ${flip.volume.buysWeek}</p>
                        <p><span class="volume">Current items sold:</span> ${flip.volume.currentBuys} (${flip.volume.buysP})</p>
                    </div>
                `;
                flipDiv.setAttribute('data-arrow', movementArrow);
                flipDiv.setAttribute('data-new', isNew);
                if (!existingFlipElements || !existingFlipElements[flip.name]) {
                    flipDiv.classList.add('fade-in');
                    setTimeout(() => {
                        flipDiv.classList.remove('fade-in')                        
                    }, 300);
                }
            }
            const expandableContent = flipDiv.querySelector('.expandable-content');
            if (expandableContent) {
                // Check if blacklist button already exists
                let blacklistButton = expandableContent.querySelector('.blacklist-button');
                if (!blacklistButton) {
                    blacklistButton = document.createElement('button');
                    blacklistButton.classList.add('blacklist-button');
                    blacklistButton.textContent = 'Blacklist';
                    blacklistButton.addEventListener('click', (event) => {
                        event.stopPropagation(); // Prevent event bubbling
                        // Add the item to the blacklist
                        const isBlacklisted = blacklistedItems.includes(flip.name);
                        if (isBlacklisted) {
                            blacklistedItems = blacklistedItems.filter(name => name !== flip.name);
                            flipDiv.style.backgroundColor = '';
                            flipDiv.style.opacity = '';
                            blacklistButton.style.display = '';
                        } else {
                            blacklistedItems.push(flip.name);
                            // Set transition before changing styles
                            flipDiv.style.transition = 'background-color 0.3s ease, opacity 0.3s ease';
                            requestAnimationFrame(() => {
                                flipDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                                flipDiv.style.opacity = '0.5';
                                blacklistButton.style.display = 'none';
                            });
                        }
                        localStorage.setItem('blacklistedItems', JSON.stringify(blacklistedItems));
                        // Update the blacklist display
                        updateBlacklistDisplay();
                        // fetchFlips();
                    });
                    expandableContent.appendChild(blacklistButton);
                } else {
                    // If the button exists, check if the item is blacklisted
                    const isBlacklisted = blacklistedItems.includes(flip.name);
                    if (isBlacklisted) {
                        // Set transition before changing styles
                        flipDiv.style.transition = 'background-color 0.3s ease, opacity 0.3s ease';
                        requestAnimationFrame(() => {
                            flipDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                            flipDiv.style.opacity = '0.5';
                            blacklistButton.style.display = 'none';
                        });
                    } else {
                        blacklistButton.style.display = '';
                        flipDiv.style.backgroundColor = '';
                        flipDiv.style.opacity = '';
                    }
                }
            }
            newFlipElements.push(flipDiv);
            // Check if the flip is blacklisted and apply/remove styles
            if (blacklistedItems.includes(flip.name)) {
                // Set transition before changing styles
                flipDiv.style.transition = 'background-color 0.3s ease, opacity 0.3s ease';
                requestAnimationFrame(() => {
                    flipDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                    flipDiv.style.opacity = '0.5';
                });
            } else {
                flipDiv.style.backgroundColor = '';
                flipDiv.style.opacity = '';
            }
        });
        firstUpdate = false;
        
        // Add blacklisted items count if it's greater than 0
        console.log(blacklisted);
        
        if (blacklisted.length > 0) {
            const blacklistedDiv = document.createElement('div');
            blacklistedDiv.classList.add('flip-item');
            blacklistedDiv.innerHTML = `<h3>${blacklisted.length} Items Blacklisted</h3>
            <p><span class="profit">Total Profit / Minute:</span> ${blacklisted.perMin}</p>
            <p>‎ </p>
            <p>‎ </p>
            <p>‎ </p>`;
            newFlipElements.push(blacklistedDiv);
        }
        
        // Now, rearrange the DOM to match the new order
        newFlipElements.forEach(flipDiv => {
            resultsDiv.appendChild(flipDiv);
        });
    }

    resultsDiv.addEventListener('click', function(event) {
        const flipDiv = event.target.closest('.flip-item');
        if (flipDiv) {
            const clickedFlipOffsetTop = flipDiv.offsetTop;
            const allFlipsInRow = Array.from(resultsDiv.querySelectorAll('.flip-item')).filter(flip => flip.offsetTop === clickedFlipOffsetTop);
            
            allFlipsInRow.forEach(flip => {
                const expandableContent = flip.querySelector('.expandable-content');
                if (expandableContent.style.display === 'none') {
                    expandableContent.style.display = 'block';
                    expandableContent.style.maxHeight = expandableContent.scrollHeight + 'px';
                } else {
                    expandableContent.style.maxHeight = '0';
                    setTimeout(() => {
                        expandableContent.style.display = 'none';
                    }, 300);
                }
            });
        }
    });

    window.addEventListener('resize', () => {
        isResizing = true;
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(() => {
            isResizing = false;
        }, 200); // Debounce the resize event
    });

    budgetInput.addEventListener('input', function() {
        if (budgetInput.value) {
            coinsLabel.classList.add('visible');
        } else {
            coinsLabel.classList.remove('visible');
        }
    });

    // Filter box functionality
    // Filter box functionality
    filterButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent form submission
        filterBox.classList.add('show');
        filterBox.classList.remove('hidden');
        body.classList.add('no-scroll'); // Disable body scroll
        document.documentElement.classList.add('no-scroll');
    });

    closeFilterBox.addEventListener('click', () => {
        filterBox.classList.remove('show');
        filterBox.classList.add('hidden');
        body.classList.remove('no-scroll'); // Enable body scroll
        document.documentElement.classList.remove('no-scroll');
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && filterBox.classList.contains('show')) {
            filterBox.classList.remove('show');
            filterBox.classList.add('hidden');
            body.classList.remove('no-scroll'); // Enable body scroll
            document.documentElement.classList.remove('no-scroll');
        }
    });

    document.addEventListener('click', (event) => {
        if (!filterBox.contains(event.target) && event.target !== filterButton && filterBox.classList.contains('show')) {
            filterBox.classList.remove('show');
            filterBox.classList.add('hidden');
            body.classList.remove('no-scroll'); // Enable body scroll
            document.documentElement.classList.remove('no-scroll');
        }
    });

    fetchFlips();
    updateBlacklistDisplay();
});
