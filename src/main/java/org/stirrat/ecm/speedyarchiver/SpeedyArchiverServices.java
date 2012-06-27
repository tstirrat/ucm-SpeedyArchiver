package org.stirrat.ecm.speedyarchiver;

import intradoc.common.DataStreamWrapper;
import intradoc.common.ServiceException;
import intradoc.common.SystemUtils;
import intradoc.data.DataBinder;
import intradoc.data.DataException;
import intradoc.server.HttpImplementor;
import intradoc.shared.SharedObjects;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Vector;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import org.apache.commons.io.IOUtils;
import org.stirrat.twine.annotation.Binder;
import org.stirrat.twine.annotation.ServiceMethod;
import org.stirrat.twine.proxy.ServiceProxy;

/**
 * Speed up your transfer of archives from one environment to another by using
 * the OOTB pages and services defined below
 */
public class SpeedyArchiverServices extends ServiceProxy {

  private static final int READ_BUFFER_SIZE = 1024;
  private static final String FILENAME_DELIMITER = "_";
  private static final String ARCHIVE_EXTENSION = ".zip";
  private static final String TIMESTAMP_FORMAT = "yyyy-MM-dd_HH-mm-ss";
  private static final String traceSection = "speedyarchiver";

  /**
   * Used to download an archive as a zip file.
   * 
   * @param archiveName
   *          The archive job name
   * @param binder
   *          The service data binder
   * @param httpImpl
   *          The service httpImplementor
   * 
   * @throws ServiceException
   *           If there is an error reading or accessing the zip file
   */
  @ServiceMethod(name = "SPEEDY_ARCHIVER_DOWNLOAD")
  public void downloadArchive(@Binder(name = "archiveName") String archiveName, DataBinder binder,
      HttpImplementor httpImpl) throws ServiceException {

    File archiveFolder = getCollectionFolder(archiveName);

    File zipFile = null;

    try {
      zipFile = compressFolderContents(archiveFolder, archiveName);

    } catch (IOException e) {
      throw new ServiceException("Error creating zip file from folder: " + archiveFolder.getName());
    }

    try {
      attachFileToHttpResponse(zipFile, httpImpl);

    } catch (IOException e) {
      throw new ServiceException("Error reading file " + zipFile.getName());
    }
  }

  /**
   * Upload an archive zip into an archive job.
   * 
   * @param archiveName
   *          The archive name
   * @param binder
   *          The service data binder
   */
  @ServiceMethod(name = "SPEEDY_ARCHIVER_UPLOAD")
  public void uploadArchive(@Binder(name = "archiveName") String archiveName, DataBinder binder)
      throws ServiceException, DataException {

    @SuppressWarnings("unchecked")
    Vector<String> v = binder.getTempFiles();

    if (v.size() <= 0) {
      throw new ServiceException("Could not upload the file. No file found.");
    }

    String uploadedFile = v.elementAt(0);

    // delete the existing folder
    if (!archiveName.equalsIgnoreCase("")) {
      String archiveFolderPath = getArchiveFolder(archiveName);

      deleteRecursively(new File(archiveFolderPath));

    } else {
      binder.putLocal("uploadedArchive", "false - Deleting aborted!");
      throw new ServiceException("archiveName is empty. Deleting aborted!");

    }

    // extract the contents of the uploaded zip
    try {
      extractZipFile(uploadedFile, archiveName);
      binder.putLocal("uploadedArchive", "true");
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  /**
   * Returns the file path to an archive.
   * 
   * @param archiveName
   * @return
   */
  private String getArchiveFolder(String archiveName) {
    String archiveFolderPath = getArchiveBaseFolder() + archiveName;
    return archiveFolderPath;
  }

  /**
   * Get the root of the archive folder.
   * 
   * @return
   */
  private String getArchiveBaseFolder() {
    String baseDir = SharedObjects.getEnvironmentValue("CollectionDir");

    if (baseDir == null) {
      baseDir = SharedObjects.getEnvironmentValue("IntradocDir") + "archives/";
    }
    return baseDir;
  }

  /**
   * Returns the folder for an archive job.
   * 
   * @param archiveName
   *          The archive job name
   * @return The folder where the archive job data is found.
   * @throws ServiceException
   *           If the job name is invalid.
   */
  private File getCollectionFolder(String archiveName) throws ServiceException {
    String archiveFolderPath = getArchiveBaseFolder() + archiveName;

    boolean exists = (new File(archiveFolderPath)).exists();

    if (exists) {
      return new File(archiveFolderPath);
    } else {
      throw new ServiceException("Archive " + archiveName + " does not exist!");
    }

  }

  /**
   * Recursively compresses a folder's contents and return the reference to the
   * output file.
   * 
   * @param inFolder
   *          The folder which represents a
   * @return
   * @throws IOException
   */
  private File compressFolderContents(File inFolder, String archiveName) throws IOException {
    String zipName = getZipFileName(archiveName);

    File outFile = new File(DataBinder.getTemporaryDirectory() + zipName);

    ZipOutputStream out = null;
    try {

      // create ZipOutputStream object
      out = new ZipOutputStream(new FileOutputStream(outFile));

      addFolderToZip(inFolder, out, inFolder);

    } finally {
      if (out != null) {
        out.close();
      }
    }
    return outFile;
  }

  /**
   * Construct a zip file name based on the archive job name and a timestamp.
   * 
   * @param archiveName
   *          The archive name
   * @return A constructed zip file name
   */
  private String getZipFileName(String archiveName) {
    Date now = Calendar.getInstance().getTime();

    String timestamp = new SimpleDateFormat(TIMESTAMP_FORMAT).format(now);

    return archiveName + FILENAME_DELIMITER + timestamp + ARCHIVE_EXTENSION;
  }

  /**
   * Recursively add folder to zip.
   * 
   * @param folder
   * @param zip
   * @param baseName
   * @throws IOException
   */
  private static void addFolderToZip(File folder, ZipOutputStream zip, File baseFolder) throws IOException {
    File[] files = folder.listFiles();

    for (File f : files) {

      if (f.isDirectory()) {
        addFolderToZip(f, zip, baseFolder);

      } else {
        // find the relative zip file path for this file entry
        String zipFilePath = f.getAbsolutePath().substring(baseFolder.getAbsolutePath().length() + 1);

        // create a new zip entry
        ZipEntry zipEntry = new ZipEntry(zipFilePath);
        zip.putNextEntry(zipEntry);

        // write to the entry
        IOUtils.copy(new FileInputStream(f), zip);

        // flush the entry
        zip.closeEntry();
      }
    }
  }

  /**
   * Returns a zip to the browser as a download option
   * 
   * @param file
   *          The zip file
   * @param httpImpl
   *          The service http object
   * @throws IOException
   */
  public void attachFileToHttpResponse(File file, HttpImplementor httpImpl) throws ServiceException, IOException {

    String mimeType = URLConnection.getFileNameMap().getContentTypeFor(file.getName());

    byte[] byteArray = getFileBytes(file);
    ByteArrayInputStream fileInputStream = new ByteArrayInputStream(byteArray);

    DataStreamWrapper dsw = new DataStreamWrapper();
    dsw.initWithInputStream(fileInputStream, byteArray.length);
    dsw.m_clientFileName = file.getName();

    if (mimeType != null) {
      dsw.m_dataType = mimeType;
    } else {
      dsw.m_dataType = "attachment";
    }

    m_binder.putLocal("noSaveAs", "true");
    httpImpl.sendStreamResponse(m_binder, dsw);
  }

  /**
   * Creates a byte array from a File object.
   * 
   * @param file
   *          The file to convert to byte array.
   * @return Byte array
   */
  public static byte[] getFileBytes(File file) throws IOException {
    InputStream is = new FileInputStream(file);

    // Get the size of the file
    long length = file.length();

    if (length > Integer.MAX_VALUE) {
      // File is too large
    }

    // Create the byte array to hold the data
    byte[] bytes = new byte[(int) length];

    // Read in the bytes
    int offset = 0;
    int numRead = 0;
    while (offset < bytes.length && (numRead = is.read(bytes, offset, bytes.length - offset)) >= 0) {
      offset += numRead;
    }

    // Ensure all the bytes have been read in
    if (offset < bytes.length) {
      throw new IOException("Could not completely read file " + file.getName());
    }

    // Close the input stream and return bytes
    is.close();
    return bytes;
  }

  /**
   * Deletes all files and subdirectories under dir. Returns true if all
   * deletions were successful. If a deletion fails, the method stops attempting
   * to delete and returns false.
   * 
   * @param file
   *          The directory/fle to truncate.
   * 
   * @return false if an error occurs.
   */
  private boolean deleteRecursively(File file) {
    if (file.isDirectory()) {
      String[] children = file.list();

      for (int i = 0; i < children.length; i++) {

        boolean success = deleteRecursively(new File(file, children[i]));

        if (!success) {
          return false;
        }
      }

    }
    // The directory is now empty so delete it
    return file.delete();
  }

  /**
   * Extract zip file into an archive folder.
   * 
   * @param zipFilename
   * @param archiveName
   */
  private void extractZipFile(String zipFilename, String archiveName) {
    try {

      File archiveFolderPath = createDestinationFolder(getArchiveFolder(archiveName));

      if (archiveFolderPath == null) {
        throw new ServiceException("Unable to create destination folder: " + archiveFolderPath);
      }

      byte[] readBuffer = new byte[READ_BUFFER_SIZE];

      ZipInputStream zipStream = null;

      ZipEntry zipFileEntry;

      zipStream = new ZipInputStream(new FileInputStream(zipFilename));

      zipFileEntry = zipStream.getNextEntry();

      while (zipFileEntry != null) {

        String entryName = zipFileEntry.getName();

        SystemUtils.trace(traceSection, "entryname " + entryName);

        File newFile = new File(entryName);
        String directory = newFile.getParent();

        if (directory != null && !directory.equalsIgnoreCase("")) {

          SystemUtils.trace(traceSection, "creating a directory structure: " + directory);

          try {
            new File(archiveFolderPath + File.separator + directory).mkdirs();

          } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
          }
        }

        FileOutputStream outStream = new FileOutputStream(archiveFolderPath + File.separator + entryName);

        int n;
        while ((n = zipStream.read(readBuffer, 0, READ_BUFFER_SIZE)) > -1) {
          outStream.write(readBuffer, 0, n);
        }

        outStream.close();
        zipStream.closeEntry();
        zipFileEntry = zipStream.getNextEntry();

      }

      zipStream.close();

    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  /**
   * Create and return the archive folder path.
   * 
   * @param archiveFolderPath
   * @return
   */
  private File createDestinationFolder(String archiveFolderPath) {
    File dest = new File(archiveFolderPath);

    if (dest.exists()) {
      return dest;

    } else {
      dest.mkdirs();
      return dest;
    }
  }
}