FROM python:3.11-alpine

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

ENV APP_NAME tool-modbus-driver
WORKDIR /usr/local/src/${APP_NAME}
COPY src .

ENTRYPOINT [ "python", "tool-modbus-driver.py" ]
EXPOSE 54321