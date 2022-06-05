const countButton = document.getElementById("count-button");

if (!countButton) {
	throw new Error("Count button not found");
}

// Initialize count from HMR data if available
let count = import.meta.hot?.data.count ?? 0;

function update() {
	countButton!.textContent = `Count: ${count}`;
}

function handleClick() {
	count++;
	update();
}

countButton.addEventListener("click", handleClick);

update();

if (import.meta.hot) {
	import.meta.hot.accept();

	import.meta.hot.dispose((data) => {
		// Remove previous event listener
		countButton.removeEventListener("click", handleClick);
		// Preserve the count value across HMR updates
		data.count = count;
	});
}
