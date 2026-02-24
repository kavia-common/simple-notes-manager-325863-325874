import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app brand", () => {
  render(<App />);
  expect(screen.getByText(/Simple Notes/i)).toBeInTheDocument();
});
