SpeedyArchiver Component

using commons-io-2.0.jar: http://commons.apache.org/io/download_io.cgi (http://commons.apache.org/io/api-1.4/)

Welcome to Vedran's "Speedy Archiver"<br/><br/>
Sometimes it is complicated to transfer acrhives from one environment to another due to environments being on different networks, making an RDP connection first that is laggy, etc. For this purpose Speedy Archiver can save time by being able to just download an archive as a zip file and then upload it to another environment all using the OOTB pages.
There are some things to keep in mind though:<br/> <br/> 
1. The definitions of archives need to exist on both environments<br/><br/> 
2. The upload will override the whole "archive/yourarchive" folder and then extract the zip file contents into it - so be careful!<br/><br/> 
3. This is still in a testing stage so there is no good security around it, nor fail safe mechanisms when deleting.<br/><br/> 