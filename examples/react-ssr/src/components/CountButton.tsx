import { useState } from "react";

export function CountButton() {
	const [count, setCount] = useState(0);

	return (
		<button id="count-button" onClick={() => setCount(count + 1)}>
			Count: {count}
		</button>
	);
}
