import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { TripPage } from "./pages/TripPage";

const App = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/:slug" element={<TripPage />} />
  </Routes>
);

export default App;
