import express from 'express';
import logger from 'morgan';

const port = process.env.PORT ?? 3000;

const app = express();
app.use(logger('dev'));

app.get('/', (req, res) => {
    res.sendFile('./client/index.html', { root: '.' });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
