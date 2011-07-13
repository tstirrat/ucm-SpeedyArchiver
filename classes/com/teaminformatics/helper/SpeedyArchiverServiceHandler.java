package com.teaminformatics.helper;

import intradoc.common.DataStreamWrapper;
import intradoc.common.ServiceException;
import intradoc.common.SystemUtils;
import intradoc.data.DataBinder;
import intradoc.data.DataException;
import intradoc.server.ServiceHandler;
import intradoc.shared.SharedObjects;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.FileNameMap;
import java.net.URLConnection;
import java.util.Vector;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import org.apache.commons.io.IOUtils;

 
/**
 * Speed up your transfer of archives from one environment to another by using the OOTB pages and services defined below
 */
public class SpeedyArchiverServiceHandler extends ServiceHandler{
	
	static final int BUFFER = 2048; //this can be changed
	
	/**
	 * This SPEEDY_ARCHIVER_DOWNLOAD service is used to download an archive folder using a simple link and return it as a zip file.
	 * It is then meant to be uploaded by another service and to replace the existing archive on the CS
	 * Therefore speeding up the process of deploying from one environment to another
	 * 
	 */
	public void downloadArchive() throws ServiceException, DataException{
		
		SystemUtils.trace("system", "SpeedyArchiverServiceHandler: downloading archive");
		
		String archiveName = m_binder.getLocal("archiveName");
		
		if(archiveName == null || archiveName.equalsIgnoreCase("")){
			throw new ServiceException("Parameter archiveName must not be empty!");
		}
		
		String archiveFolderPath = SharedObjects.getEnvironmentValue("IntradocDir") + "archives/" + archiveName;
		
		boolean exists = (new File(archiveFolderPath)).exists(); 
		if (exists) { 
			File zipFile = compressFolder(new File(archiveFolderPath), archiveName);
			returnZipThroughDownload(zipFile);
		}
		else { 
			throw new ServiceException("Archive " + archiveName + " does not exist!");
		}
		
		SystemUtils.trace("system", "SpeedyArchiverServiceHandler: download complete");
	}	
	
	/**
	 * Recursivley compresses a folder and returns it as a zip file
	 *
	 * @param file - the temp file returned from the SPEEDY_ARCHIVER_DOWNLOAD service
	 * @return - The zip byte stream
	 */
	 private File compressFolder(File inFolder, String archiveName)
	 {
		 SystemUtils.trace("system", "SpeedyArchiverServiceHandler: compressing the folder");
		 File outFile = new File(DataBinder.getTemporaryDirectory() + archiveName + "_" + DataBinder.getNextFileCounter() + ".zip");
		 
			try {

				//create ZipOutputStream object
				ZipOutputStream out = new ZipOutputStream(new FileOutputStream(outFile));
								
				//get path prefix so that the zip file does not contain the whole path
				// eg. if folder to be zipped is /home/lalit/test
				// the zip file when opened will have test folder and not home/lalit/test folder
				int len = inFolder.getAbsolutePath().lastIndexOf(File.separator);
				String baseName = inFolder.getAbsolutePath().substring(0,len+1);
				
				addFolderToZip(inFolder, out, baseName);
				
				out.close();
			} catch (FileNotFoundException e) {
				e.printStackTrace();
			} catch (IOException e) {
				e.printStackTrace();
			}
			
		return outFile;

	 }
	 
	private static void addFolderToZip(File folder, ZipOutputStream zip, String baseName) throws IOException {
		File[] files = folder.listFiles();
		for (File file : files) {
			if (file.isDirectory()) {
				addFolderToZip(file, zip, baseName);
			} else {
				String name = file.getAbsolutePath().substring(baseName.length());
				ZipEntry zipEntry = new ZipEntry(name);
				zip.putNextEntry(zipEntry);
				IOUtils.copy(new FileInputStream(file), zip);
				zip.closeEntry();
			}
		}
	}
	
	/**
	 * Returns a zip to the browser as a download option
	 *
	 * @param file - the temp file returned from the SPEEDY_ARCHIVER_DOWNLOAD service
	 * @return - The zip byte stream
	 */
	public void returnZipThroughDownload(File file)throws DataException, ServiceException{

		SystemUtils.trace("system", "SpeedyArchiverServiceHandler: calling returnZipThroughDownload");

		DataStreamWrapper dsw = new DataStreamWrapper();
		dsw.m_clientFileName = file.getName();

		byte[] docxByteArray = null;
		try{
			docxByteArray = getBytesFromFile(file);

			FileNameMap fileNameMap = URLConnection.getFileNameMap();
			String mimeType = fileNameMap.getContentTypeFor(dsw.m_clientFileName);

			if(mimeType != null){
				dsw.m_dataType = mimeType;		
			}
			else{
				dsw.m_dataType = "attachment";
			}
		}
		catch(Exception e){
			String throwEx = m_binder.getAllowMissing("throwerr");
			if(throwEx != null && throwEx.equals("false")){
			}
			else{	
				throw new ServiceException(e);
			}
		}

		ByteArrayInputStream bis = new ByteArrayInputStream(docxByteArray);
		dsw.initWithInputStream(bis, docxByteArray.length);

		//trace("setting noSaveAs=1 for inline content-disposition");
		m_binder.putLocal("noSaveAs", "true");
		//trace("sending stream now...");
		m_service.getHttpImplementor().sendStreamResponse(m_binder, dsw);
		//trace("...sending stream finished");

		SystemUtils.trace("system", "SpeedyArchiverServiceHandler: ending returnZipThroughDownload");
	}
	
	/**
	 * Creates a byte array from a File object (temp file)
	 *
	 * @param file - the temp file returned from the SPEEDY_ARCHIVER_DOWNLOAD service
	 * @return - the byte array from that temp file
	 */
	public static byte[] getBytesFromFile(File file) throws IOException {
		InputStream is = new FileInputStream(file);

		// Get the size of the file
		long length = file.length();

		if (length > Integer.MAX_VALUE) {
			// File is too large
		}

		// Create the byte array to hold the data
		byte[] bytes = new byte[(int)length];

		// Read in the bytes
		int offset = 0;
		int numRead = 0;
		while (offset < bytes.length
				&& (numRead=is.read(bytes, offset, bytes.length-offset)) >= 0) {
			offset += numRead;
		}

		// Ensure all the bytes have been read in
		if (offset < bytes.length) {
			throw new IOException("Could not completely read file "+file.getName());
		}

		// Close the input stream and return bytes
		is.close();
		return bytes;
	}

	
	/**
	 * This SPEEDY_ARCHIVER_UPLOAD service is used to upload an archive folder using a simple form and override the existing one.
	 * Therefore speeding up the process of deploying from one environment to another
	 * 
	 */
	@SuppressWarnings("rawtypes")
	public void uploadArchive() throws ServiceException, DataException{
		SystemUtils.trace("system", "SpeedyArchiverServiceHandler: uploading archive");
		
		String archiveName = m_binder.getLocal("archiveName");
		
		if(archiveName == null || archiveName.equalsIgnoreCase("")){
			throw new ServiceException("Parameter archiveName must not be empty!");
		}

		Vector v = this.m_binder.getTempFiles();
		
	    if (v.size() <= 0)
	    {
	      throw new ServiceException("Could not upload the file. No file found.");
	    }

	    String uploadedFile = (String)v.elementAt(0);
	    
	    SystemUtils.trace("system", "SpeedyArchiverServiceHandler: uploading file " + uploadedFile);
	    
	    //delete the existing folder
	    if(archiveName != null && !archiveName.equalsIgnoreCase("")){
			String archiveFolderPath = SharedObjects.getEnvironmentValue("IntradocDir") + "archives/" + archiveName;
			deleteDir(new File(archiveFolderPath));	
	    }else{
	    	m_binder.putLocal("uploadedArchive", "false - Deleting aborted!");
	    	throw new ServiceException("archiveName is empty. Deleting aborted!");
	    	
	    }
		
		//extract the contents of the uploaded zip
		try
        {
            getZipFiles(uploadedFile, archiveName);
            m_binder.putLocal("uploadedArchive", "true");
        }
        catch (Exception e)
        {
            e.printStackTrace();
        }
		
		
		
		SystemUtils.trace("system", "SpeedyArchiverServiceHandler: upload complete");
	}

	// Deletes all files and subdirectories under dir.
	// Returns true if all deletions were successful.
	// If a deletion fails, the method stops attempting to delete and returns false.
	private boolean deleteDir(File dir) {
		if (dir.isDirectory()) {
			String[] children = dir.list();
			for (int i=0; i<children.length; i++) {
				boolean success = deleteDir(new File(dir, children[i]));
				if (!success) {
					return false;
				}
			}
		}
	
		// The directory is now empty so delete it
		return dir.delete();
	} 
	
	private void getZipFiles(String filename, String archiveName)
    {
        try
        {
        	String archiveFolderPath = SharedObjects.getEnvironmentValue("IntradocDir") + "archives/";
            byte[] buf = new byte[1024];
            ZipInputStream zipinputstream = null;
            ZipEntry zipentry;
            zipinputstream = new ZipInputStream(new FileInputStream(filename));

            zipentry = zipinputstream.getNextEntry();
            while (zipentry != null) 
            { 
                //for each entry to be extracted
                String entryName = zipentry.getName();
                System.out.println("entryname "+entryName);
                int n;
                FileOutputStream fileoutputstream;
                File newFile = new File(entryName);
                String directory = newFile.getParent();
                
                /*if(directory == null)
                {
                    if(newFile.isDirectory())
                        break;
                }*/
                
                if(directory != null && !directory.equalsIgnoreCase(""))
                {
                	System.out.println("creating a directory structure: " + directory);
                	try {
                		new File(archiveFolderPath+directory).mkdirs();
                	} catch(Exception e) {
                		System.err.println("Error: " + e.getMessage());
                	}
                }
                
                
                fileoutputstream = new FileOutputStream(archiveFolderPath+entryName);             

                while ((n = zipinputstream.read(buf, 0, 1024)) > -1)
                    fileoutputstream.write(buf, 0, n);

                fileoutputstream.close(); 
                zipinputstream.closeEntry();
                zipentry = zipinputstream.getNextEntry();

            }//while

            zipinputstream.close();
        }
        catch (Exception e)
        {
            e.printStackTrace();
        }
    }
		
}
