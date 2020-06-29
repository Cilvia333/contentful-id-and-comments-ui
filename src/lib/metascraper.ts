import ky from "ky";
import  {getMetadata} from "page-metadata-parser";
import domino from "domino";

const getOgp = async (url: string) => {
    try {
        const html = await ky.get(url).text();
        const doc = domino.createDocument(html);
        console.log(url);
        console.log(doc);
        return getMetadata(doc, url); 
    }
    catch(e){
        console.log(`ERROR: ${e}`);
        return null;
    }
}

export default getOgp;