import { Routes, Route, BrowserRouter } from 'react-router-dom';
import Video from './pages/Video';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Video />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
