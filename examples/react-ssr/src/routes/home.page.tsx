import { CountButton } from "../components/CountButton";
import { Nav } from "../components/Nav";

export default function HomePage() {
	return (
		<div>
			<h1>Welcome to the Home Page</h1>
			<p>This is a server-side rendered React application running on Fastly.</p>
			<p>And here's some interactive content for good measure:</p>
			<p>
				<CountButton />
			</p>
			<Nav />
		</div>
	);
}
