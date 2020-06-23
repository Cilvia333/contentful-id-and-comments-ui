import ky from "ky";
import  {getMetadata} from "page-metadata-parser";
import domino from "domino";

const getOgp = async (url: string) => {
    try {
        const html = await ky.get(url).text();
        const doc = domino.createWindow(html).document;
        return getMetadata(doc, url); 
    }
    catch(e){
        return null;
    }
}

export default getOgp;