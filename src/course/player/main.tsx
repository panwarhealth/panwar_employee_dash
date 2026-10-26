import { createRoot } from 'react-dom/client';
import type { CourseDoc } from '../doc';
import { Player } from '../Player';
import { memoryLms, scormLms } from '../scorm';
import '../player.css';

fetch('./course.json')
  .then((r) => r.json() as Promise<CourseDoc>)
  .then((doc) => {
    document.title = doc.title;
    const lms = scormLms() ?? memoryLms(`course:${doc.title}`);
    createRoot(document.getElementById('root')!).render(<Player doc={doc} lms={lms} />);
  });
